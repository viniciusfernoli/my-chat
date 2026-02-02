'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, X, Check, Search, Settings, Trash2, UserPlus, UserMinus, Crown, Edit2 } from 'lucide-react';
import { Modal, Input, Button, Avatar, Spinner } from '@/components/ui';
import { useAuthStore, useChatStore } from '@/stores';
import { useSocket } from '@/providers/RealtimeProvider';
import { IUser, IConversation } from '@/types';

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: IConversation;
  onGroupUpdated?: (group: IConversation) => void;
  onGroupDeleted?: () => void;
  onMemberRemoved?: (memberId: string) => void;
}

interface GroupMember extends IUser {
  isOwner?: boolean;
}

export function GroupSettingsModal({
  isOpen,
  onClose,
  conversation,
  onGroupUpdated,
  onGroupDeleted,
  onMemberRemoved,
}: GroupSettingsModalProps) {
  const { user } = useAuthStore();
  const { conversations, updateConversation, removeConversation } = useChatStore();
  const { notifyGroupUpdate, notifyMemberAdded, notifyMemberRemoved } = useSocket();
  
  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState(conversation.name || '');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableContacts, setAvailableContacts] = useState<IUser[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = conversation.ownerId === user?.id;

  // Carregar membros do grupo
  const loadMembers = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/groups/${conversation.id}/members`, {
        headers: { 'x-user-id': user.id },
      });

      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [conversation.id, user]);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setGroupName(conversation.name || '');
    }
  }, [isOpen, conversation.name, loadMembers]);

  // Carregar contatos disponíveis para adicionar
  useEffect(() => {
    if (!user || !showAddMember) return;
    
    const contacts = new Map<string, IUser>();
    const memberIds = new Set(members.map(m => m.id));
    
    conversations.forEach(conv => {
      conv.participants.forEach(p => {
        if (p.id !== user.id && !memberIds.has(p.id)) {
          contacts.set(p.id, p);
        }
      });
    });
    
    setAvailableContacts(Array.from(contacts.values()));
  }, [conversations, user, showAddMember, members]);

  const filteredContacts = availableContacts.filter(u =>
    u.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateName = async () => {
    if (!user || !groupName.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/groups/${conversation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ name: groupName.trim() }),
      });

      if (res.ok) {
        const updatedGroup = await res.json();
        updateConversation(conversation.id, { name: updatedGroup.name });
        
        // Notificar outros membros via WebSocket
        const participantIds = members.filter(m => m.id !== user.id).map(m => m.id);
        notifyGroupUpdate(conversation.id, { name: updatedGroup.name }, participantIds);
        
        onGroupUpdated?.(updatedGroup);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Erro ao atualizar grupo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (newMember: IUser) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/groups/${conversation.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ memberId: newMember.id }),
      });

      if (res.ok) {
        // Atualizar lista local
        setMembers(prev => [...prev, { ...newMember, isOwner: false }]);
        setAvailableContacts(prev => prev.filter(c => c.id !== newMember.id));
        
        // Notificar via WebSocket
        notifyMemberAdded(conversation.id, newMember);
        
        setShowAddMember(false);
        setSearchTerm('');
      }
    } catch (error) {
      console.error('Erro ao adicionar membro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/groups/${conversation.id}/members?memberId=${memberId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      });

      if (res.ok) {
        // Atualizar lista local
        const removedMember = members.find(m => m.id === memberId);
        setMembers(prev => prev.filter(m => m.id !== memberId));
        
        if (removedMember) {
          // Notificar via WebSocket
          notifyMemberRemoved(conversation.id, memberId);
        }
        
        onMemberRemoved?.(memberId);
      }
    } catch (error) {
      console.error('Erro ao remover membro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/groups/${conversation.id}/members?memberId=${user.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      });

      if (res.ok) {
        removeConversation(conversation.id);
        onClose();
      }
    } catch (error) {
      console.error('Erro ao sair do grupo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/groups/${conversation.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      });

      if (res.ok) {
        // Notificar membros que o grupo foi deletado
        const participantIds = members.filter(m => m.id !== user.id).map(m => m.id);
        participantIds.forEach(memberId => {
          notifyMemberRemoved(conversation.id, memberId);
        });
        
        removeConversation(conversation.id);
        onGroupDeleted?.();
        onClose();
      }
    } catch (error) {
      console.error('Erro ao deletar grupo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Configurações do Grupo"
      size="md"
    >
      <div className="space-y-5">
        {/* Nome do grupo */}
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            Nome do Grupo
          </label>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nome do grupo"
                className="flex-1"
              />
              <Button onClick={handleUpdateName} disabled={isLoading || !groupName.trim()}>
                <Check size={18} />
              </Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                <X size={18} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                  <Users size={20} className="text-white" />
                </div>
                <span className="font-medium text-white">{conversation.name}</span>
              </div>
              {isOwner && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 size={16} />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Membros */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-dark-300">
              Membros ({members.length})
            </label>
            {isOwner && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAddMember(!showAddMember)}
              >
                <UserPlus size={16} className="mr-1" />
                Adicionar
              </Button>
            )}
          </div>

          {/* Adicionar membro */}
          {showAddMember && (
            <div className="mb-3 p-3 bg-dark-700 rounded-lg space-y-2">
              <Input
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search size={16} />}
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {filteredContacts.length === 0 ? (
                  <p className="text-center text-dark-400 py-2 text-sm">
                    Nenhum contato disponível
                  </p>
                ) : (
                  filteredContacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => handleAddMember(contact)}
                      disabled={isLoading}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-dark-600 transition-colors"
                    >
                      <Avatar src={contact.avatar} name={contact.nickname} size="sm" />
                      <span className="flex-1 text-left text-white text-sm">{contact.nickname}</span>
                      <UserPlus size={14} className="text-primary-400" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Lista de membros */}
          {isLoadingMembers ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2 bg-dark-700 rounded-lg"
                >
                  <Avatar src={member.avatar} name={member.nickname} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{member.nickname}</span>
                      {member.isOwner && (
                        <span title="Dono do grupo">
                          <Crown size={14} className="text-yellow-500" />
                        </span>
                      )}
                      {member.id === user?.id && (
                        <span className="text-xs text-dark-400">(você)</span>
                      )}
                    </div>
                  </div>
                  {/* Botão de remover (apenas dono pode remover outros, exceto a si mesmo) */}
                  {isOwner && member.id !== user?.id && !member.isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isLoading}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <UserMinus size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="pt-3 border-t border-dark-700 space-y-2">
          {!isOwner ? (
            <Button
              variant="ghost"
              onClick={handleLeaveGroup}
              disabled={isLoading}
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <X size={18} className="mr-2" />
              Sair do Grupo
            </Button>
          ) : (
            <>
              {!confirmDelete ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={18} className="mr-2" />
                  Excluir Grupo
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleDeleteGroup}
                    disabled={isLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Confirmar Exclusão
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
