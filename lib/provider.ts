import { ethers } from 'ethers'
import { type WalletClient } from 'viem'

export async function walletClientToSigner(walletClient: WalletClient): Promise<ethers.JsonRpcSigner> {
  const { account } = walletClient
  if (!account) {
    throw new Error('Wallet account not found')
  }
  
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not found. Please connect your wallet.')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return signer
}

export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not found. Please connect your wallet.')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return signer
}

export function getReadOnlyProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.drpc.org'
  return new ethers.JsonRpcProvider(rpcUrl)
}

