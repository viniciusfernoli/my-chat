'use client';

import { useState, useEffect } from 'react';
import { Users, X, Check, Search } from 'lucide-react';
import { Modal, Input, Button, Avatar } from '@/components/ui';
import { useAuthStore, useChatStore } from '@/stores';
import { IUser, IConversation } from '@/types';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: IConversation) => void;
}

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const { user } = useAuthStore();
  const { conversations } = useChatStore();
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Buscar todos os participantes de conversas existentes como contatos
  useEffect(() => {
    if (!user) return;
    
    const contacts = new Map<string, IUser>();
    
    conversations.forEach(conv => {
      conv.participants.forEach(p => {
        if (p.id !== user.id) {
          contacts.set(p.id, p);
        }
      });
    });
    
    setAvailableUsers(Array.from(contacts.values()));
  }, [conversations, user]);

  const filteredUsers = availableUsers.filter(u =>
    u.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUserSelection = (userToToggle: IUser) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === userToToggle.id);
      if (isSelected) {
        return prev.filter(u => u.id !== userToToggle.id);
      }
      return [...prev, userToToggle];
    });
  };

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim() || selectedUsers.length < 1) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          participantIds: selectedUsers.map(u => u.id),
        }),
      });

      if (res.ok) {
        const group = await res.json();
        onGroupCreated(group);
        handleClose();
      }
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSearchTerm('');
    setSelectedUsers([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Criar Grupo">
      <div className="space-y-4">
        {/* Nome do grupo */}
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5">
            Nome do Grupo
          </label>
          <Input
            placeholder="Digite o nome do grupo..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            icon={<Users size={18} />}
          />
        </div>

        {/* Usuários selecionados */}
        {selectedUsers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">
              Participantes selecionados ({selectedUsers.length})
            </label>
            <div className="flex flex-wrap gap-2 p-2 bg-dark-700 rounded-lg">
              {selectedUsers.map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-primary-600 rounded-full"
                >
                  <Avatar src={u.avatar} name={u.nickname} size="xs" />
                  <span className="text-sm text-white">{u.nickname}</span>
                  <button
                    onClick={() => toggleUserSelection(u)}
                    className="p-0.5 hover:bg-primary-500 rounded-full"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buscar usuários */}
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5">
            Adicionar Participantes
          </label>
          <Input
            placeholder="Buscar contatos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>

        {/* Lista de usuários disponíveis */}
        <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
          {filteredUsers.length === 0 ? (
            <p className="text-center text-dark-400 py-4">
              {searchTerm ? 'Nenhum contato encontrado' : 'Você ainda não tem contatos'}
            </p>
          ) : (
            filteredUsers.map(u => {
              const isSelected = selectedUsers.some(s => s.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUserSelection(u)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-primary-600/20 border border-primary-500'
                      : 'bg-dark-700 hover:bg-dark-600'
                  }`}
                >
                  <Avatar src={u.avatar} name={u.nickname} size="sm" />
                  <span className="flex-1 text-left text-white">{u.nickname}</span>
                  {isSelected && (
                    <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedUsers.length < 1 || isLoading}
            isLoading={isLoading}
            className="flex-1"
          >
            Criar Grupo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
