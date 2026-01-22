'use client';

import { useState, useRef } from 'react';
import { Camera, Save, X } from 'lucide-react';
import { Avatar, Button, Input, Textarea, Modal } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { IUser, UserStatus } from '@/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: 'online', label: 'Online', color: 'bg-green-500' },
  { value: 'away', label: 'Ausente', color: 'bg-yellow-500' },
  { value: 'busy', label: 'Ocupado', color: 'bg-red-500' },
  { value: 'offline', label: 'Invisível', color: 'bg-gray-500' },
];

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, setUser } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [status, setStatus] = useState<UserStatus>(user?.status || 'online');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!user) return;

    if (nickname.length < 3 || nickname.length > 20) {
      setError('O apelido deve ter entre 3 e 20 caracteres');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ nickname, bio, status }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar perfil');
        return;
      }

      const updatedUser = await res.json();
      setUser(updatedUser);
      onClose();
    } catch {
      setError('Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil" size="md">
      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar
              src={user?.avatar}
              name={user?.nickname}
              size="xl"
              status={status}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-primary-600 rounded-full text-white hover:bg-primary-700 transition-colors"
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              // TODO: Implementar upload de imagem
            />
          </div>
          <p className="text-xs text-dark-500 mt-2">Clique para alterar a foto</p>
        </div>

        {/* Nickname */}
        <Input
          label="Apelido"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          error={nickname.length > 0 && nickname.length < 3 ? 'Mínimo 3 caracteres' : undefined}
        />

        {/* Bio */}
        <Textarea
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conte um pouco sobre você..."
          maxLength={200}
          rows={3}
        />
        <p className="text-xs text-dark-500 text-right -mt-4">
          {bio.length}/200
        </p>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  status === option.value
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-dark-600 hover:border-dark-500'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${option.color}`} />
                <span className="text-sm text-white">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-dark-700">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save size={16} className="mr-2" />
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
