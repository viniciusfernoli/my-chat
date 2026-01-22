# SecureChat 🔐

Chat seguro com criptografia end-to-end, inspirado no Discord mas com foco em simplicidade e privacidade.

## ✨ Funcionalidades

- 🔐 **Criptografia End-to-End**: Todas as mensagens são criptografadas usando TweetNaCl
- 🔑 **Autenticação por Secret Key**: Acesse sua conta usando uma chave secreta única
- 💬 **Mensagens em Tempo Real**: Comunicação instantânea via WebSocket
- 🎬 **GIFs**: Busque e envie GIFs usando a API do Giphy
- 😊 **Reações**: Reaja às mensagens com emojis
- 📷 **Imagens**: Compartilhe imagens nas conversas
- 👤 **Perfil Personalizável**: Avatar, apelido e bio
- 📱 **Design Responsivo**: Funciona em desktop e mobile

## 🛠️ Stack Tecnológico

- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Banco de Dados**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Real-time**: Socket.io
- **Criptografia**: TweetNaCl
- **Estado**: Zustand
- **Ícones**: Lucide React

## 📁 Estrutura do Projeto

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

## 🚀 Como Executar

### Pré-requisitos

- Node.js 18+
- PostgreSQL (ou conta no Neon)
- Conta no Giphy (para API de GIFs)

### Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd securechat
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```

4. Edite o arquivo `.env.local` com suas credenciais:
```env
DATABASE_URL="postgresql://user:password@host:5432/securechat?sslmode=require"
NEXT_PUBLIC_GIPHY_API_KEY="sua_chave_giphy"
JWT_SECRET="sua_chave_secreta"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

5. Execute as migrações do banco de dados:
```bash
npm run db:push
```

6. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

7. Acesse [http://localhost:3000](http://localhost:3000)

## 📦 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa o linter
- `npm run db:generate` - Gera o cliente Prisma
- `npm run db:push` - Sincroniza o schema com o banco
- `npm run db:studio` - Abre o Prisma Studio

## 🔐 Como Funciona a Criptografia

1. **Geração de Chaves**: Ao criar uma conta, um par de chaves (pública/privada) é gerado
2. **Criptografia**: As mensagens são criptografadas com a chave pública do destinatário
3. **Descriptografia**: Apenas o destinatário pode descriptografar usando sua chave privada
4. **Armazenamento**: O servidor armazena apenas mensagens criptografadas

## 🎨 Temas e Customização

O projeto usa Tailwind CSS com um tema personalizado inspirado no Discord. As cores principais estão em `tailwind.config.js`.

## 📝 Convenções de Código

- **Componentes**: PascalCase (ex: `ChatWindow.tsx`)
- **Funções/Variáveis**: camelCase (ex: `sendMessage`)
- **Arquivos utilitários**: kebab-case (ex: `date-utils.ts`)
- **Types/Interfaces**: PascalCase com prefixo I (ex: `IMessage`)

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Feito com ❤️ e 🔐
