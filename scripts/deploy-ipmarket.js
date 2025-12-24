const ethers = require('ethers')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org'

if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY not found in .env.local')
}

async function deploy() {
  console.log('Deploying IP Marketplace contract to Sepolia...')

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  console.log('Deployer address:', wallet.address)

  const contractPath = path.join(__dirname, '../contracts/IPMarketplace.sol')
  const contractSource = fs.readFileSync(contractPath, 'utf8')

  const artifactPath = path.join(__dirname, '../artifacts/contracts/IPMarketplace.sol/IPMarketplace.json')
  
  if (!fs.existsSync(artifactPath)) {
    console.log('Contract artifact not found. Compiling with solc...')
    
    const solc = require('solc')
    const input = {
      language: 'Solidity',
      sources: {
        'IPMarketplace.sol': {
          content: contractSource,
        },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode'],
          },
        },
      },
    }

    const output = JSON.parse(solc.compile(JSON.stringify(input)))
    
    if (output.errors) {
      output.errors.forEach(err => {
        if (err.severity === 'error') {
          console.error('Compilation error:', err.message)
        }
      })
      if (output.errors.some(err => err.severity === 'error')) {
        process.exit(1)
      }
    }

    const contract = output.contracts['IPMarketplace.sol']['IPMarketplace']
    const abi = contract.abi
    const bytecode = contract.evm.bytecode.object

    console.log('Deploying contract...')
    const factory = new ethers.ContractFactory(abi, bytecode, wallet)
    const contractInstance = await factory.deploy()
    
    await contractInstance.waitForDeployment()
    const address = await contractInstance.getAddress()

    console.log('\n✅ IP Marketplace contract deployed at:', address)
    console.log(`\nAdd to .env.local:`)
    console.log(`NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=${address}`)

    const envPath = path.join(__dirname, '../.env.local')
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
    
    if (envContent.includes('NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(/NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=.*\n/g, '')
    }
    envContent += `NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=${address}\n`
    
    fs.writeFileSync(envPath, envContent)
    console.log('\n✅ .env.local updated!')
  } else {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)
    
    console.log('Deploying contract...')
    const contractInstance = await factory.deploy()
    
    await contractInstance.waitForDeployment()
    const address = await contractInstance.getAddress()

    console.log('\n✅ IP Marketplace contract deployed at:', address)
    console.log(`\nAdd to .env.local:`)
    console.log(`NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=${address}`)

    const envPath = path.join(__dirname, '../.env.local')
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
    
    if (envContent.includes('NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(/NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=.*\n/g, '')
    }
    envContent += `NEXT_PUBLIC_IPMARKET_CONTRACT_ADDRESS=${address}\n`
    
    fs.writeFileSync(envPath, envContent)
    console.log('\n✅ .env.local updated!')
  }
}

deploy().catch((error) => {
  console.error('Deployment failed:', error)
  process.exit(1)
})

