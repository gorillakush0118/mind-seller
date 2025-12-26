```
███╗   ███╗██╗███╗   ██╗██████╗ ███████╗███████╗██╗     ██╗     ███████╗██████╗
████╗ ████║██║████╗  ██║██╔══██╗██╔════╝██╔════╝██║     ██║     ██╔════╝██╔══██╗
██╔████╔██║██║██╔██╗ ██║██║  ██║█████╗  ███████╗██║     ██║     █████╗  ██████╔╝
██║╚██╔╝██║██║██║╚██╗██║██║  ██║██╔══╝  ╚════██║██║     ██║     ██╔══╝  ██╔══██╗
██║ ╚═╝ ██║██║██║ ╚████║██████╔╝███████╗███████║███████╗███████╗███████╗██║  ██║
╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
```

Encrypted marketplace for trading ideas and intellectual property.  
Private by design. On-chain by default.

⸻

## 🧠 What mindSELLER is

mindSELLER is a decentralized marketplace for buying and selling ideas, intellectual property, and early-stage innovation — without revealing the content upfront.

All listings, interests, and deal data remain encrypted until both parties explicitly agree to proceed.

**Key Innovation**: Uses Fully Homomorphic Encryption (FHE) via Zama FHEVM to ensure that sensitive IP data remains encrypted throughout the entire trading process, even during computations on the blockchain.

⸻

## 🔐 Core mechanics

- **Encrypted idea listings**: Sellers create listings with encrypted descriptions and details stored as FHE handles on-chain
- **Encrypted buyer interest profiles**: Buyers can publish encrypted interest profiles describing what they're looking for
- **Private deal proposals**: Deal proposals include encrypted seller and buyer data
- **Conditional disclosure**: Data remains encrypted until deal completion and both parties agree
- **On-chain settlement**: Payments and ownership transfers happen automatically via smart contracts
- **FHE operations**: All sensitive data operations use Fully Homomorphic Encryption, allowing computations on encrypted data without decryption

**No plaintext at rest.**  
**No implicit trust.**  
**FHE-encrypted by design.**

⸻

## 🧩 Supported assets

- Startup ideas and business concepts
- Algorithms and technical designs
- Patents and patent applications
- Trademarks and brand identities
- Trade secrets and proprietary know-how
- Research outputs and academic work
- Creative concepts and IP drafts

Anything valuable before disclosure can be safely listed and traded.

⸻

## 👁 Usage flow

### Seller workflow

1. **Create encrypted listing**: 
   - Enter title (public) and IP type
   - Write description and details (encrypted with FHE)
   - Set price in ETH
   - Submit - data is encrypted via FHE Relayer before on-chain storage

2. **Manage listings**: 
   - View all your listings
   - Monitor deal proposals
   - Cancel listings if needed

3. **Review proposals**: 
   - See incoming deal proposals from buyers
   - Accept deals when terms are acceptable

4. **Complete deals**: 
   - After buyer completes payment, deal is finalized
   - Buyer receives access to decrypted IP data

### Buyer workflow

1. **Browse or create interest**: 
   - Browse all active listings (titles and types are public)
   - Create encrypted interest profile describing what you're looking for

2. **Propose deals**: 
   - Select a listing that matches your interest
   - Propose a deal with your terms
   - Add encrypted buyer data to the proposal

3. **Wait for acceptance**: 
   - Seller reviews and accepts your proposal

4. **Complete payment**: 
   - Send payment in ETH
   - Receive access to decrypted IP data upon completion

⸻

## 🌐 Technical stack

### Blockchain & Privacy
- **Network**: Ethereum Sepolia Testnet
- **Privacy Layer**: Fully Homomorphic Encryption (FHE) via Zama FHEVM
- **Encryption**: FHE Relayer SDK for client-side encryption
- **Storage**: On-chain storage of FHE handles (encrypted data references)

### Frontend
- **Framework**: Next.js 14 with React and TypeScript
- **Styling**: Tailwind CSS with gradient design
- **Wallet Integration**: Wagmi + RainbowKit for wallet connections
- **Blockchain Interaction**: Ethers.js v6 for contract calls

### Smart Contracts
- **Language**: Solidity ^0.8.20
- **Contract**: IPMarketplace.sol with FHE handle support
- **Functions**: Create listings, buyer interests, propose/accept/complete deals
- **FHE Integration**: Stores and retrieves FHE handles for encrypted data

### Development Tools
- **Build Tool**: Hardhat for contract compilation
- **RPC Provider**: drpc.org for Sepolia network access
- **Deployment**: Manual deployment via Hardhat scripts

⸻

## 📁 Project structure

```
28-wallet/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Main page component
│   ├── providers.tsx      # Wagmi/RainbowKit providers
│   └── globals.css        # Global styles
├── components/
│   └── IPMarketplace.tsx  # Main marketplace component with FHE integration
├── contracts/
│   └── IPMarketplace.sol  # Smart contract with FHE handle support
├── lib/
│   └── provider.ts        # Blockchain provider utilities
├── scripts/
│   └── deploy-ipmarket.js # Contract deployment script
└── Configuration files (package.json, tsconfig.json, etc.)
```

⸻

## 🚀 Setup and deployment

### Prerequisites

- Node.js 18+ and npm
- Ethereum wallet with Sepolia testnet ETH
- Git (for version control)

### Local development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Create `.env.local`:
   ```env
   SEPOLIA_RPC_URL=https://sepolia.drpc.org
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.drpc.org
   NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=0x3224D615960F3f3746a1Fd416fda41303e687bc1
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
   PRIVATE_KEY=your_private_key_for_deployment
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Compile contracts** (if needed):
   ```bash
   npm run compile
   ```

### Contract deployment

1. **Deploy to Sepolia**:
   ```bash
   npm run deploy:ipmarket
   ```

2. **Update contract address** in `.env.local` and Vercel environment variables

### Production deployment

Deployed on Vercel: **https://mindseller.vercel.app**

Environment variables are configured in Vercel dashboard for production builds.

⸻

## 🔒 FHE Architecture

### How FHE works in mindSELLER

1. **Client-side encryption**:
   - User enters sensitive data (IP descriptions, interests, etc.)
   - FHE Relayer SDK encrypts the data using Fully Homomorphic Encryption
   - Encrypted data handle (bytes32) is created

2. **On-chain storage**:
   - Contract receives and stores FHE handles (not plaintext)
   - Handles represent encrypted values that can be used in computations
   - No decryption happens on-chain

3. **Privacy preservation**:
   - All sensitive data remains encrypted throughout the process
   - Only public metadata (titles, categories, prices) is visible
   - Actual IP content stays private until deal completion

4. **Deal completion**:
   - When deal is completed, encrypted data can be decrypted by authorized parties
   - Decryption happens client-side using the FHE Relayer SDK

### FHE Functions in Contract

The contract includes functions to retrieve FHE handles:
- `getListingEncryptedDescription()` - Get FHE handle for listing description
- `getListingEncryptedDetails()` - Get FHE handle for listing details
- `getInterestEncryptedInterests()` - Get FHE handle for buyer interests
- `getInterestEncryptedCriteria()` - Get FHE handle for buyer criteria
- `getDealEncryptedSellerData()` - Get FHE handle for deal seller data
- `getDealEncryptedBuyerData()` - Get FHE handle for deal buyer data

⸻

## 📊 Contract information

**Contract Address**: `0x3224D615960F3f3746a1Fd416fda41303e687bc1`  
**Network**: Sepolia Testnet  
**Deployer**: `0xDD645f1EAE2A4a554F86d296f6A392bE846fDB13`

### Main functions

- `createListing()` - Create new IP listing with FHE-encrypted data
- `createBuyerInterest()` - Create buyer interest profile with FHE-encrypted interests
- `proposeDeal()` - Propose deal between listing and buyer interest
- `acceptDeal()` - Accept a proposed deal
- `completeDeal()` - Complete deal with payment and data transfer
- `cancelListing()` - Cancel an active listing
- `getActiveListings()` - Get all active listings
- `getSellerListings()` - Get listings by seller address
- `getBuyerInterests()` - Get interests by buyer address
- `getUserDeals()` - Get all deals for a user

⸻

## 🧪 Current status

**Live on**: https://mindseller.vercel.app  
**Network**: Sepolia Testnet  
**Status**: Experimental / Production-ready

### Features implemented

✅ FHE encryption integration via Zama FHEVM Relayer SDK  
✅ Encrypted listing creation and storage  
✅ Encrypted buyer interest profiles  
✅ Deal proposal and acceptance system  
✅ On-chain payment settlement  
✅ Modern gradient UI with responsive design  
✅ Wallet connection via RainbowKit  
✅ Smart contract with FHE handle support  
✅ Production deployment on Vercel

### Known considerations

- Running on Sepolia testnet (test tokens only)
- FHE operations require relayer connection
- Gas costs may vary based on network conditions
- Experimental technology - use at your own risk

⸻

## 👤 About the operator

**gorillakush**

Experienced web3 user since 2014, active during the ICO boom era.  
Passionate about privacy-first systems, building applications, and exploring hidden meta in the crypto space.

**Philosophy**: Code over promises. Privacy by design.

**Contact**:  
- Telegram: gorillakush0118  
- Discord: gorillakush0118

⸻

## 📝 License

MIT License - See LICENSE file for details

⸻

## 🙏 Acknowledgments

Built with:
- [Zama FHEVM](https://www.zama.ai/) for Fully Homomorphic Encryption
- [Next.js](https://nextjs.org/) for the web framework
- [Wagmi](https://wagmi.sh/) and [RainbowKit](https://www.rainbowkit.com/) for wallet integration
- [Ethereum](https://ethereum.org/) for the blockchain infrastructure

