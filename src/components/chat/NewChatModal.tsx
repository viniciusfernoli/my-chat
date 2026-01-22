'use client';

import { useState } from 'react';
import { Search, X, Loader2, UserPlus } from 'lucide-react';
import { Input, Button, Avatar, Modal } from '@/components/ui';
import { IUser } from '@/types';
import { useAuthStore } from '@/stores';
import { debounce } from '@/lib/utils';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function NewChatModal({ isOpen, onClose, onSelectUser }: NewChatModalProps) {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(query)}`, {
        headers: {
          'x-user-id': user?.id || '',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = debounce(searchUsers, 300);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    debouncedSearch(value);
  };

  const handleSelectUser = () => {
    if (selectedUser) {
      onSelectUser(selectedUser.id);
      onClose();
      setSearch('');
      setUsers([]);
      setSelectedUser(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Conversa" size="md">
      <div className="space-y-4">
        {/* Search input */}
        <Input
          placeholder="Buscar por apelido..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          icon={<Search size={16} />}
        />

        {/* Users list */}
        <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          )}

          {!isLoading && search.length < 2 && (
            <div className="text-center py-8 text-dark-500 text-sm">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}

          {!isLoading && search.length >= 2 && users.length === 0 && (
            <div className="text-center py-8 text-dark-500 text-sm">
              Nenhum usuário encontrado
            </div>
          )}

          {!isLoading && users.length > 0 && (
            <div className="space-y-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedUser?.id === u.id
                      ? 'bg-primary-600/20 border border-primary-500'
                      : 'hover:bg-dark-700'
                  }`}
                >
                  <Avatar src={u.avatar} name={u.nickname} size="md" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white">{u.nickname}</p>
                    {u.bio && (
                      <p className="text-sm text-dark-400 truncate">{u.bio}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-dark-700">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSelectUser} disabled={!selectedUser}>
            <UserPlus size={16} className="mr-2" />
            Iniciar Conversa
          </Button>
        </div>
      </div>
    </Modal>
  );
}
