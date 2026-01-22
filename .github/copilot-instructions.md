# SecureChat - Instruções do Projeto

## Visão Geral
Chat seguro com criptografia end-to-end, similar ao Discord mas simplificado (sem servidores/canais).

## Stack Tecnológico
- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Banco de Dados**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Real-time**: Socket.io
- **Criptografia**: TweetNaCl (E2E)

## Estrutura de Pastas
```
src/
├── app/                    # App Router (Next.js 14)
│   ├── (auth)/            # Rotas de autenticação
│   ├── (chat)/            # Rotas do chat
│   └── api/               # API Routes
├── components/            # Componentes React
│   ├── ui/               # Componentes base (Button, Input, etc.)
│   ├── chat/             # Componentes do chat
│   ├── profile/          # Componentes de perfil
│   └── shared/           # Componentes compartilhados
├── hooks/                # Custom hooks
├── lib/                  # Utilitários e configurações
│   ├── crypto/          # Criptografia E2E
│   ├── db/              # Configuração do Prisma
│   └── utils/           # Funções utilitárias
├── services/            # Serviços (API, WebSocket)
├── stores/              # Estado global (Zustand)
├── types/               # TypeScript types/interfaces
└── styles/              # Estilos globais
```

## Convenções de Código
- Componentes: PascalCase
- Funções/variáveis: camelCase
- Arquivos de componentes: PascalCase.tsx
- Arquivos utilitários: kebab-case.ts
- Types/Interfaces: PascalCase com prefixo I para interfaces

## Padrões
- Todos os componentes devem ser funcionais
- Usar Server Components quando possível
- Client Components apenas quando necessário (interatividade)
- Separar lógica de negócio dos componentes
- Manter componentes pequenos e focados
