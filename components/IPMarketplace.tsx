'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient, useSwitchChain, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'
import { walletClientToSigner, getSigner, getReadOnlyProvider } from '@/lib/provider'
import { sepolia } from 'wagmi/chains'
import { formatEther, parseEther } from 'viem'

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000').trim()

const CONTRACT_ABI = [
  'function createListing(uint8 _ipType, string memory _title, bytes32 _encryptedDescription, bytes32 _encryptedDetails, uint256 _price) external returns (uint256)',
  'function createBuyerInterest(string memory _category, bytes32 _encryptedInterests, bytes32 _encryptedCriteria, uint256 _maxPrice) external returns (uint256)',
  'function proposeDeal(uint256 _listingId, uint256 _interestId, uint256 _proposedPrice, bytes32 _encryptedSellerData, bytes32 _encryptedBuyerData) external returns (uint256)',
  'function acceptDeal(uint256 _dealId) external',
  'function completeDeal(uint256 _dealId) external payable',
  'function cancelListing(uint256 _listingId) external',
  'function deactivateInterest(uint256 _interestId) external',
  'function getSellerListings(address _seller) external view returns (uint256[])',
  'function getBuyerInterests(address _buyer) external view returns (uint256[])',
  'function getUserDeals(address _user) external view returns (uint256[])',
  'function getActiveListings(uint256 _limit) external view returns (uint256[])',
  'function listings(uint256) external view returns (uint256 id, address owner, uint8 ipType, string memory title, bytes32 encryptedDescription, bytes32 encryptedDetails, uint256 price, uint8 status, uint256 createdAt)',
  'function buyerInterests(uint256) external view returns (uint256 id, address buyer, string memory category, bytes32 encryptedInterests, bytes32 encryptedCriteria, uint256 maxPrice, uint256 createdAt, bool isActive)',
  'function deals(uint256) external view returns (uint256 id, uint256 listingId, uint256 interestId, address seller, address buyer, uint256 proposedPrice, bytes32 encryptedSellerData, bytes32 encryptedBuyerData, uint8 status, uint256 createdAt, uint256 completedAt)',
  'function getListingEncryptedDescription(uint256 _listingId) external view returns (bytes32)',
  'function getListingEncryptedDetails(uint256 _listingId) external view returns (bytes32)',
  'function getInterestEncryptedInterests(uint256 _interestId) external view returns (bytes32)',
  'function getInterestEncryptedCriteria(uint256 _interestId) external view returns (bytes32)',
  'function getDealEncryptedSellerData(uint256 _dealId) external view returns (bytes32)',
  'function getDealEncryptedBuyerData(uint256 _dealId) external view returns (bytes32)',
  'event IPListingCreated(uint256 indexed listingId, address indexed owner, uint8 ipType, string title, uint256 price)',
  'event BuyerInterestCreated(uint256 indexed interestId, address indexed buyer, string category, uint256 maxPrice)',
  'event DealProposed(uint256 indexed dealId, uint256 indexed listingId, uint256 indexed interestId, address seller, address buyer, uint256 proposedPrice)',
  'event DealAccepted(uint256 indexed dealId, address indexed seller, address indexed buyer)',
  'event DealCompleted(uint256 indexed dealId, address indexed seller, address indexed buyer, uint256 finalPrice)',
]

type Tab = 'HOME' | 'LISTINGS' | 'MY_LISTINGS' | 'INTERESTS' | 'MY_INTERESTS' | 'DEALS' | 'ABOUT'

const IP_TYPES = ['Patent', 'Trademark', 'TradeSecret', 'Copyright', 'Innovation']

interface IPListing {
  id: number
  owner: string
  ipType: number
  title: string
  price: bigint
  status: number
  createdAt: bigint
}

interface BuyerInterest {
  id: number
  buyer: string
  category: string
  maxPrice: bigint
  createdAt: bigint
  isActive: boolean
}

interface Deal {
  id: number
  listingId: number
  interestId: number
  seller: string
  buyer: string
  proposedPrice: bigint
  status: number
  createdAt: bigint
  completedAt: bigint
}

export default function IPMarketplace() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChain } = useSwitchChain()
  const chainId = useChainId()

  const [activeTab, setActiveTab] = useState<Tab>('HOME')
  const [isLoading, setIsLoading] = useState(false)
  const [relayerInstance, setRelayerInstance] = useState<any>(null)
  const [isRelayerLoading, setIsRelayerLoading] = useState(false)
  
  // Listings
  const [allListings, setAllListings] = useState<IPListing[]>([])
  const [myListings, setMyListings] = useState<IPListing[]>([])
  const [newListingTitle, setNewListingTitle] = useState('')
  const [newListingType, setNewListingType] = useState(0)
  const [newListingPrice, setNewListingPrice] = useState('')
  const [newListingDescription, setNewListingDescription] = useState('')
  
  // Interests
  const [allInterests, setAllInterests] = useState<BuyerInterest[]>([])
  const [myInterests, setMyInterests] = useState<BuyerInterest[]>([])
  const [newInterestCategory, setNewInterestCategory] = useState('')
  const [newInterestMaxPrice, setNewInterestMaxPrice] = useState('')
  const [newInterestDetails, setNewInterestDetails] = useState('')
  
  // Deals
  const [myDeals, setMyDeals] = useState<Deal[]>([])
  const [selectedListingForDeal, setSelectedListingForDeal] = useState<number | null>(null)
  const [selectedInterestForDeal, setSelectedInterestForDeal] = useState<number | null>(null)
  const [proposedPrice, setProposedPrice] = useState('')

  useEffect(() => {
    if (isConnected && chainId !== sepolia.id) {
      switchChain({ chainId: sepolia.id })
    }
  }, [isConnected, chainId, switchChain])

  useEffect(() => {
    initRelayer()
  }, [])

  useEffect(() => {
    if (isConnected && address && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      loadData()
    }
  }, [isConnected, address])

  // Initialize FHE relayer
  const initRelayer = async () => {
    setIsRelayerLoading(true)
    try {
      const relayerModule: any = await Promise.race([
        import('@zama-fhe/relayer-sdk/web'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Relayer timeout')), 10000))
      ])

      const sdkInitialized = await Promise.race([
        relayerModule.initSDK(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SDK init timeout')), 10000))
      ])
      if (!sdkInitialized) {
        throw new Error('SDK init failed')
      }

      const instance = await Promise.race([
        relayerModule.createInstance(relayerModule.SepoliaConfig),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Instance creation timeout')), 10000))
      ])
      setRelayerInstance(instance)
    } catch (error) {
      console.error('Failed to initialize relayer:', error)
    } finally {
      setIsRelayerLoading(false)
    }
  }

  // Encrypt string data using FHE
  const encryptString = async (data: string): Promise<{ encrypted: string; attestation: string }> => {
    if (!relayerInstance || !address) {
      throw new Error('Relayer not initialized or wallet not connected')
    }

    // Convert string to hash and then to number for FHE encryption
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(data))
    const hashNumber = BigInt(dataHash) % BigInt(2**31 - 1)

    const inputBuilder = relayerInstance.createEncryptedInput(
      CONTRACT_ADDRESS,
      address
    )
    inputBuilder.add32(Number(hashNumber))

    const encryptedInput = await Promise.race([
      inputBuilder.encrypt(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Encryption timeout')), 30000)
      )
    ]) as any

    if (!encryptedInput?.handles || encryptedInput.handles.length === 0) {
      throw new Error('Encryption failed')
    }

    return {
      encrypted: encryptedInput.handles[0],
      attestation: encryptedInput.inputProof || '0x'
    }
  }

  const getEthersSigner = async () => {
    if (walletClient) {
      return await walletClientToSigner(walletClient)
    }
    return await getSigner()
  }

  const loadData = async () => {
    if (!address) return
    await Promise.all([
      loadAllListings(),
      loadMyListings(),
      loadAllInterests(),
      loadMyInterests(),
      loadMyDeals()
    ])
  }

  const loadAllListings = async () => {
    try {
      const provider = getReadOnlyProvider()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const listingIds = await contract.getActiveListings(100)
      
      const listingPromises = listingIds.map(async (id: bigint) => {
        const listing = await contract.listings(id)
        return {
          id: Number(id),
          owner: listing.owner,
          ipType: listing.ipType,
          title: listing.title,
          price: listing.price,
          status: listing.status,
          createdAt: listing.createdAt
        }
      })
      
      const loaded = await Promise.all(listingPromises)
      setAllListings(loaded)
    } catch (error) {
      console.error('Failed to load listings:', error)
    }
  }

  const loadMyListings = async () => {
    if (!address) return
    try {
      const provider = getReadOnlyProvider()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const listingIds = await contract.getSellerListings(address)
      
      const listingPromises = listingIds.map(async (id: bigint) => {
        const listing = await contract.listings(id)
        return {
          id: Number(id),
          owner: listing.owner,
          ipType: listing.ipType,
          title: listing.title,
          price: listing.price,
          status: listing.status,
          createdAt: listing.createdAt
        }
      })
      
      const loaded = await Promise.all(listingPromises)
      setMyListings(loaded)
    } catch (error) {
      console.error('Failed to load my listings:', error)
    }
  }

  const loadAllInterests = async () => {
    try {
      setAllInterests([])
    } catch (error) {
      console.error('Failed to load interests:', error)
    }
  }

  const loadMyInterests = async () => {
    if (!address) return
    try {
      const provider = getReadOnlyProvider()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const interestIds = await contract.getBuyerInterests(address)
      
      const interestPromises = interestIds.map(async (id: bigint) => {
        const interest = await contract.buyerInterests(id)
        return {
          id: Number(id),
          buyer: interest.buyer,
          category: interest.category,
          maxPrice: interest.maxPrice,
          createdAt: interest.createdAt,
          isActive: interest.isActive
        }
      })
      
      const loaded = await Promise.all(interestPromises)
      setMyInterests(loaded)
    } catch (error) {
      console.error('Failed to load my interests:', error)
    }
  }

  const loadMyDeals = async () => {
    if (!address) return
    try {
      const provider = getReadOnlyProvider()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const dealIds = await contract.getUserDeals(address)
      
      const dealPromises = dealIds.map(async (id: bigint) => {
        const deal = await contract.deals(id)
        return {
          id: Number(id),
          listingId: Number(deal.listingId),
          interestId: Number(deal.interestId),
          seller: deal.seller,
          buyer: deal.buyer,
          proposedPrice: deal.proposedPrice,
          status: deal.status,
          createdAt: deal.createdAt,
          completedAt: deal.completedAt
        }
      })
      
      const loaded = await Promise.all(dealPromises)
      setMyDeals(loaded)
    } catch (error) {
      console.error('Failed to load deals:', error)
    }
  }

  const createListing = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet')
      return
    }

    if (!relayerInstance) {
      alert('FHE relayer is not ready. Please wait...')
      return
    }

    if (!newListingTitle.trim() || !newListingPrice || parseFloat(newListingPrice) <= 0) {
      alert('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const descriptionText = newListingDescription || newListingTitle
      const detailsText = `Details: ${newListingDescription}`

      // Encrypt using FHE
      const { encrypted: encryptedDescription } = await encryptString(descriptionText)
      const { encrypted: encryptedDetails } = await encryptString(detailsText)
      
      const price = parseEther(newListingPrice)
      
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      
      const tx = await contract.createListing(
        newListingType,
        newListingTitle,
        encryptedDescription,
        encryptedDetails,
        price
      )
      
      const receipt = await tx.wait()
      
      // Get listing ID from event
      const listingId = receipt.logs?.[0]?.topics?.[1] 
        ? Number(receipt.logs[0].topics[1])
        : null

      // Store original data for decryption (owner can decrypt their own listings)
      if (listingId !== null && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`listing_${listingId}`, JSON.stringify({
            description: descriptionText,
            details: detailsText,
            encryptedDescription,
            encryptedDetails
          }))
        } catch (e) {
          console.error('Failed to store listing data:', e)
        }
      }

      alert('Listing created successfully!')
      
      setNewListingTitle('')
      setNewListingPrice('')
      setNewListingDescription('')
      await loadData()
    } catch (error: any) {
      console.error('Failed to create listing:', error)
      alert(`Failed to create listing: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const createInterest = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet')
      return
    }

    if (!relayerInstance) {
      alert('FHE relayer is not ready. Please wait...')
      return
    }

    if (!newInterestCategory.trim() || !newInterestMaxPrice || parseFloat(newInterestMaxPrice) <= 0) {
      alert('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const interestsText = newInterestDetails || newInterestCategory
      const criteriaText = `Criteria: ${newInterestDetails}`

      // Encrypt using FHE
      const { encrypted: encryptedInterests } = await encryptString(interestsText)
      const { encrypted: encryptedCriteria } = await encryptString(criteriaText)
      
      const maxPrice = parseEther(newInterestMaxPrice)
      
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      
      const tx = await contract.createBuyerInterest(
        newInterestCategory,
        encryptedInterests,
        encryptedCriteria,
        maxPrice
      )
      
      const receipt = await tx.wait()
      
      // Get interest ID from event
      const interestId = receipt.logs?.[0]?.topics?.[1] 
        ? Number(receipt.logs[0].topics[1])
        : null

      // Store original data for decryption
      if (interestId !== null && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`interest_${interestId}`, JSON.stringify({
            interests: interestsText,
            criteria: criteriaText,
            encryptedInterests,
            encryptedCriteria
          }))
        } catch (e) {
          console.error('Failed to store interest data:', e)
        }
      }

      alert('Buyer interest created successfully!')
      
      setNewInterestCategory('')
      setNewInterestMaxPrice('')
      setNewInterestDetails('')
      await loadData()
    } catch (error: any) {
      console.error('Failed to create interest:', error)
      alert(`Failed to create interest: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const proposeDeal = async (listingId: number, interestId: number, priceEth?: string) => {
    if (!isConnected || !address) {
      alert('Please connect your wallet')
      return
    }

    if (!relayerInstance) {
      alert('FHE relayer is not ready. Please wait...')
      return
    }

    let price: bigint
    if (priceEth && priceEth.trim()) {
      if (parseFloat(priceEth) <= 0) {
        alert('Please enter a valid proposed price')
        return
      }
      price = parseEther(priceEth)
    } else {
      const listing = allListings.find(l => l.id === listingId)
      if (!listing) {
        alert('Listing not found')
        return
      }
      price = listing.price
    }

    setIsLoading(true)
    try {
      // Encrypt deal data using FHE
      const sellerDataText = `Deal data for listing ${listingId}`
      const buyerDataText = `Deal data for interest ${interestId}`
      
      const { encrypted: encryptedSellerData } = await encryptString(sellerDataText)
      const { encrypted: encryptedBuyerData } = await encryptString(buyerDataText)
      
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      
      const tx = await contract.proposeDeal(
        listingId,
        interestId,
        price,
        encryptedSellerData,
        encryptedBuyerData
      )
      
      const receipt = await tx.wait()
      
      // Get deal ID from event
      const dealId = receipt.logs?.[0]?.topics?.[1] 
        ? Number(receipt.logs[0].topics[1])
        : null

      // Store original data for decryption
      if (dealId !== null && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`deal_${dealId}`, JSON.stringify({
            sellerData: sellerDataText,
            buyerData: buyerDataText,
            encryptedSellerData,
            encryptedBuyerData
          }))
        } catch (e) {
          console.error('Failed to store deal data:', e)
        }
      }

      alert('Deal proposed successfully!')
      setProposedPrice('')
      await loadData()
    } catch (error: any) {
      console.error('Failed to propose deal:', error)
      alert(`Failed to propose deal: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const acceptDeal = async (dealId: number) => {
    if (!isConnected) {
      alert('Please connect your wallet')
      return
    }

    setIsLoading(true)
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      
      const tx = await contract.acceptDeal(dealId)
      await tx.wait()
      alert('Deal accepted!')
      await loadData()
    } catch (error: any) {
      console.error('Failed to accept deal:', error)
      alert(`Failed to accept deal: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const completeDeal = async (dealId: number, price: bigint) => {
    if (!isConnected) {
      alert('Please connect your wallet')
      return
    }

    setIsLoading(true)
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      
      const tx = await contract.completeDeal(dealId, { value: price })
      await tx.wait()
      alert('Deal completed successfully!')
      await loadData()
    } catch (error: any) {
      console.error('Failed to complete deal:', error)
      alert(`Failed to complete deal: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const cancelListing = async (listingId: number) => {
    if (!isConnected) {
      alert('Please connect your wallet')
      return
    }

    setIsLoading(true)
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      
      const tx = await contract.cancelListing(listingId)
      await tx.wait()
      alert('Listing cancelled!')
      await loadData()
    } catch (error: any) {
      console.error('Failed to cancel listing:', error)
      alert(`Failed to cancel listing: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-pink-900/90 backdrop-blur-lg shadow-2xl border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              mindSELLER
            </h1>
            <p className="text-purple-200 text-sm mt-1">Encrypted Marketplace for Ideas</p>
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Navigation Tabs with Modern Design */}
      <div className="bg-slate-800/50 backdrop-blur-md border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-center gap-1 py-2 flex-wrap">
            {(['HOME', 'LISTINGS', 'MY_LISTINGS', 'INTERESTS', 'MY_INTERESTS', 'DEALS', 'ABOUT'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-semibold transition-all duration-200 rounded-t-lg ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105'
                    : 'text-purple-200 hover:text-white hover:bg-purple-800/30'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* FHE Relayer Loading Indicator */}
        {isRelayerLoading && (
          <div className="mb-6 bg-yellow-900/50 border border-yellow-500/50 rounded-xl p-4 text-center">
            <p className="text-yellow-200">Initializing FHE encryption system...</p>
          </div>
        )}
        {!isRelayerLoading && !relayerInstance && (
          <div className="mb-6 bg-red-900/50 border border-red-500/50 rounded-xl p-4 text-center">
            <p className="text-red-200">FHE encryption system failed to initialize. Please refresh the page.</p>
          </div>
        )}
        {/* Home Tab */}
        {activeTab === 'HOME' && (
          <div className="space-y-8">
            {/* App Description */}
            <div className="bg-gradient-to-br from-slate-800/80 to-purple-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-purple-500/30">
              <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Welcome to mindSELLER
              </h2>
              <div className="space-y-4 text-lg leading-relaxed text-gray-200">
                <p>
                  A revolutionary platform that enables inventors and innovators to securely trade intellectual property while maintaining complete privacy.
                </p>
                <p>
                  Using <span className="font-bold text-purple-300">Fully Homomorphic Encryption (FHE)</span>, all IP descriptions and buyer interests remain encrypted throughout the entire process. Inventors can list their patents, trademarks, trade secrets, copyrights, and innovations without revealing sensitive details until both parties agree to a deal.
                </p>
                <p>
                  Buyers can create encrypted interest profiles describing what they're looking for, and the platform enables private matching and deal negotiation. All transactions happen on the blockchain, ensuring transparency and security, while FHE ensures that the actual content of the IP and interests remain completely private.
                </p>
                <p>
                  Deals are proposed, accepted, and completed entirely on-chain, with payments automatically processed through smart contracts. This creates a trustless marketplace where intellectual property can be traded securely without exposing valuable information prematurely.
                </p>
              </div>
            </div>

            {/* Author Info */}
            <div className="bg-gradient-to-br from-purple-800/80 to-pink-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-pink-500/30">
              <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                About the Author
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold">
                    G
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-pink-300">gorillakush</h3>
                    <p className="text-purple-200">Experienced web3 user</p>
                  </div>
                </div>
                <div className="space-y-3 text-gray-200">
                  <p className="text-lg">
                    <span className="font-semibold text-purple-300">In crypto since 2014</span>, from the ICO boom era
                  </p>
                  <p className="text-lg">
                    <span className="font-semibold text-purple-300">Interested in:</span> technologies, building applications, hidden meta
                  </p>
                  <div className="flex gap-6 mt-6 pt-6 border-t border-purple-500/30">
                    <div>
                      <p className="text-sm text-purple-300 font-semibold mb-1">Discord</p>
                      <p className="text-purple-100">gorillakush0118</p>
                    </div>
                    <div>
                      <p className="text-sm text-purple-300 font-semibold mb-1">Telegram</p>
                      <p className="text-purple-100">gorillakush0118</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'ABOUT' && (
          <div className="bg-gradient-to-br from-purple-800/80 to-pink-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-pink-500/30">
            <h2 className="text-4xl font-bold mb-8 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              About the Author
            </h2>
            <div className="space-y-6">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-4xl font-bold shadow-xl">
                  G
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-pink-300 mb-2">gorillakush</h3>
                  <p className="text-xl text-purple-200">Experienced web3 user</p>
                </div>
              </div>
              
              <div className="space-y-4 text-lg leading-relaxed text-gray-200">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                  <p className="text-xl font-semibold text-purple-300 mb-2">Background</p>
                  <p>In crypto since <span className="font-bold text-pink-300">2014</span>, from the ICO boom era. Witnessed the evolution of blockchain technology from early Bitcoin adoption to modern DeFi and Web3 applications.</p>
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                  <p className="text-xl font-semibold text-purple-300 mb-2">Interests</p>
                  <p>Passionate about <span className="font-bold text-pink-300">technologies</span>, <span className="font-bold text-pink-300">building applications</span>, and exploring <span className="font-bold text-pink-300">hidden meta</span> in the crypto space.</p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                  <p className="text-xl font-semibold text-purple-300 mb-2">Contact</p>
                  <div className="space-y-2">
                    <p><span className="font-semibold text-purple-200">Discord:</span> <span className="text-pink-300">gorillakush0118</span></p>
                    <p><span className="font-semibold text-purple-200">Telegram:</span> <span className="text-pink-300">gorillakush0118</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Listings Tab */}
        {activeTab === 'LISTINGS' && (
          <div>
            <h2 className="text-3xl font-bold mb-6 text-purple-300">All Active IP Listings ({allListings.length})</h2>
            {allListings.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-purple-500/30">
                <p className="text-gray-400 text-lg">No active listings</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allListings.map((listing) => (
                  <div key={listing.id} className="bg-gradient-to-br from-slate-800/80 to-purple-900/50 backdrop-blur-xl rounded-xl shadow-xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:transform hover:scale-105">
                    <h3 className="font-bold text-xl mb-3 text-blue-300">{listing.title}</h3>
                    <p className="text-sm text-purple-200 mb-3">Type: <span className="text-purple-300 font-semibold">{IP_TYPES[listing.ipType]}</span></p>
                    <p className="text-2xl font-bold text-green-400 mb-4">
                      {formatEther(listing.price)} ETH
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      Owner: {listing.owner.slice(0, 6)}...{listing.owner.slice(-4)}
                    </p>
                    {address && listing.owner.toLowerCase() !== address.toLowerCase() && (
                      <button
                        onClick={() => {
                          setSelectedListingForDeal(listing.id)
                          setActiveTab('MY_INTERESTS')
                        }}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all duration-200 font-semibold"
                      >
                        Propose Deal
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Listings Tab */}
        {activeTab === 'MY_LISTINGS' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-800/80 to-indigo-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-indigo-500/30">
              <h2 className="text-3xl font-bold mb-6 text-indigo-300">Create New IP Listing</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-semibold text-purple-200">Title</label>
                  <input
                    type="text"
                    value={newListingTitle}
                    onChange={(e) => setNewListingTitle(e.target.value)}
                    placeholder="My Innovation/Patent Title"
                    className="w-full px-4 py-3 border border-purple-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-purple-200">IP Type</label>
                  <select
                    value={newListingType}
                    onChange={(e) => setNewListingType(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-purple-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                  >
                    {IP_TYPES.map((type, idx) => (
                      <option key={idx} value={idx}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-purple-200">Description (will be encrypted)</label>
                  <textarea
                    value={newListingDescription}
                    onChange={(e) => setNewListingDescription(e.target.value)}
                    placeholder="Describe your IP (details remain encrypted)"
                    className="w-full px-4 py-3 border border-purple-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-purple-200">Price (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newListingPrice}
                    onChange={(e) => setNewListingPrice(e.target.value)}
                    placeholder="0.1"
                    className="w-full px-4 py-3 border border-purple-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <button
                  onClick={createListing}
                  disabled={isLoading || !isConnected}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-lg"
                >
                  {isLoading ? 'Creating...' : 'Create Listing'}
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-6 text-purple-300">My Listings ({myListings.length})</h2>
              {myListings.length === 0 ? (
                <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-purple-500/30">
                  <p className="text-gray-400 text-lg">You haven't created any listings yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myListings.map((listing) => (
                    <div key={listing.id} className="bg-gradient-to-br from-slate-800/80 to-purple-900/50 backdrop-blur-xl rounded-xl shadow-xl p-6 border border-purple-500/30">
                      <h3 className="font-bold text-xl mb-3 text-blue-300">{listing.title}</h3>
                      <p className="text-sm text-purple-200 mb-3">Type: <span className="text-purple-300 font-semibold">{IP_TYPES[listing.ipType]}</span></p>
                      <p className="text-2xl font-bold text-green-400 mb-4">
                        {formatEther(listing.price)} ETH
                      </p>
                      <p className="text-xs text-gray-400 mb-4">
                        Status: <span className={listing.status === 0 ? 'text-green-400' : listing.status === 1 ? 'text-blue-400' : 'text-red-400'}>
                          {listing.status === 0 ? 'Active' : listing.status === 1 ? 'Sold' : 'Cancelled'}
                        </span>
                      </p>
                      {listing.status === 0 && (
                        <button
                          onClick={() => cancelListing(listing.id)}
                          disabled={isLoading}
                          className="w-full px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-500 hover:to-pink-500 disabled:opacity-50 transition-all duration-200 font-semibold"
                        >
                          Cancel Listing
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buyer Interests Tab */}
        {activeTab === 'INTERESTS' && (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-purple-500/30">
            <h2 className="text-3xl font-bold mb-4 text-purple-300">Active Buyer Interests</h2>
            <p className="text-gray-400 text-lg">Interests are encrypted and private. Create your own interest to get matched.</p>
          </div>
        )}

        {/* My Interests Tab */}
        {activeTab === 'MY_INTERESTS' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-800/80 to-indigo-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-indigo-500/30">
              <h2 className="text-3xl font-bold mb-6 text-indigo-300">Create Buyer Interest</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-semibold text-purple-200">Category</label>
                  <input
                    type="text"
                    value={newInterestCategory}
                    onChange={(e) => setNewInterestCategory(e.target.value)}
                    placeholder="e.g., AI Technology, Medical Devices"
                    className="w-full px-4 py-3 border border-purple-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-purple-200">Interest Details (will be encrypted)</label>
                  <textarea
                    value={newInterestDetails}
                    onChange={(e) => setNewInterestDetails(e.target.value)}
                    placeholder="Describe what you're looking for (details remain encrypted)"
                    className="w-full px-4 py-3 border border-purple-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-purple-200">Max Price (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newInterestMaxPrice}
                    onChange={(e) => setNewInterestMaxPrice(e.target.value)}
                    placeholder="1.0"
                    className="w-full px-4 py-3 border border-purple-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                {selectedListingForDeal && myInterests.length > 0 && (
                  <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
                    <p className="text-blue-200 mb-2">Propose deal for listing #{selectedListingForDeal}</p>
                    <input
                      type="number"
                      step="0.001"
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(e.target.value)}
                      placeholder="Proposed price in ETH (leave empty to use listing price)"
                      className="w-full px-4 py-3 border border-blue-500/50 rounded-lg bg-slate-900/50 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 mb-2"
                    />
                    <button
                      onClick={() => {
                        proposeDeal(selectedListingForDeal, myInterests[0].id, proposedPrice || undefined)
                        setSelectedListingForDeal(null)
                        setProposedPrice('')
                      }}
                      disabled={isLoading}
                      className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 transition-all duration-200 font-semibold"
                    >
                      {isLoading ? 'Proposing...' : 'Propose Deal'}
                    </button>
                  </div>
                )}
                <button
                  onClick={createInterest}
                  disabled={isLoading || !isConnected}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-lg"
                >
                  {isLoading ? 'Creating...' : 'Create Interest'}
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-6 text-purple-300">My Interests ({myInterests.length})</h2>
              {myInterests.length === 0 ? (
                <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-purple-500/30">
                  <p className="text-gray-400 text-lg">You haven't created any interests yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myInterests.map((interest) => (
                    <div key={interest.id} className="bg-gradient-to-br from-slate-800/80 to-green-900/50 backdrop-blur-xl rounded-xl shadow-xl p-6 border border-green-500/30">
                      <h3 className="font-bold text-xl mb-3 text-green-300">{interest.category}</h3>
                      <p className="text-2xl font-bold text-green-400 mb-4">
                        Max: {formatEther(interest.maxPrice)} ETH
                      </p>
                      <p className="text-sm text-gray-400 mb-4">
                        Status: <span className={interest.isActive ? 'text-green-400' : 'text-red-400'}>
                          {interest.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deals Tab */}
        {activeTab === 'DEALS' && (
          <div>
            <h2 className="text-3xl font-bold mb-6 text-purple-300">My Deals ({myDeals.length})</h2>
            {myDeals.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-purple-500/30">
                <p className="text-gray-400 text-lg">No deals yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myDeals.map((deal) => {
                  const statusText = ['Pending', 'Accepted', 'Completed', 'Rejected'][deal.status]
                  const isSeller = deal.seller.toLowerCase() === address?.toLowerCase()
                  const isBuyer = deal.buyer.toLowerCase() === address?.toLowerCase()
                  
                  return (
                    <div key={deal.id} className="bg-gradient-to-br from-slate-800/80 to-purple-900/50 backdrop-blur-xl rounded-xl shadow-xl p-6 border border-purple-500/30">
                      <h3 className="font-bold text-xl mb-4 text-purple-300">Deal #{deal.id}</h3>
                      <div className="space-y-2 text-sm text-purple-200 mb-4">
                        <p>Listing: <span className="text-purple-300 font-semibold">#{deal.listingId}</span></p>
                        <p>Interest: <span className="text-purple-300 font-semibold">#{deal.interestId}</span></p>
                        <p className="text-2xl font-bold text-green-400 mt-4">
                          {formatEther(deal.proposedPrice)} ETH
                        </p>
                        <p className="text-xs text-gray-400 mt-4">
                          Seller: {deal.seller.slice(0, 6)}...{deal.seller.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Buyer: {deal.buyer.slice(0, 6)}...{deal.buyer.slice(-4)}
                        </p>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm">
                          Status: <span className={`font-semibold ${
                            deal.status === 2 ? 'text-green-400' : 
                            deal.status === 3 ? 'text-red-400' : 
                            'text-yellow-400'
                          }`}>{statusText}</span>
                        </p>
                      </div>
                      {deal.status === 0 && !isSeller && isBuyer && (
                        <button
                          onClick={() => acceptDeal(deal.id)}
                          disabled={isLoading}
                          className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 transition-all duration-200 font-semibold mb-2"
                        >
                          Accept Deal
                        </button>
                      )}
                      {deal.status === 1 && isBuyer && (
                        <button
                          onClick={() => completeDeal(deal.id, deal.proposedPrice)}
                          disabled={isLoading}
                          className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 transition-all duration-200 font-semibold"
                        >
                          Complete Deal & Pay
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
