const { expect } = require("chai");
const { Wallet } = require('ethers');
const { ethers } = require('hardhat');
const dotenv = require("dotenv");
dotenv.config()

describe("Flash Loan with Aave", async() => {
  
    let SimpleFlashLoan, simpleFlashLoan, DexContract, dexContract;
    let addr1, addr2;

    const POLYGON_POOL_PROVIDER = "0x4CeDCB57Af02293231BAA9D39354D6BFDFD251e0";
    
    const USDC_ADDRESS = "0x52D800ca262522580CeBAD275395ca6e7598C014";
    const USDC_ABI = ["function transfer(address to, uint256 value) external returns (bool)"];
    const USDC_DECIMALS = 6;
    
    const DAI_ADDRESS = "0xc8c0cf9436f4862a8f60ce680ca5a9f0f99b5ded"; 
    const DAI_ABI = ["function transfer(address to, uint256 value) external returns (bool)"];
    const DAI_DECIMALS = 18;

    const FLASHLOAN_AMOUNT = ethers.utils.parseUnits("1000", USDC_DECIMALS); 
   
    before(async()=>{
        [addr1, addr2] = await ethers.getSigners();
        
        DexContract = await ethers.getContractFactory("Dex");
        dexContract = await DexContract.deploy(DAI_ADDRESS, USDC_ADDRESS);
        console.log("Dex Contract Address: ", dexContract.address);

        SimpleFlashLoan = await ethers.getContractFactory("FlashLoanArbitrage");
        simpleFlashLoan = await SimpleFlashLoan.deploy(POLYGON_POOL_PROVIDER, DAI_ADDRESS, USDC_ADDRESS, dexContract.address);
        console.log("Flash Loan Contract Address: ", simpleFlashLoan.address);
        
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545'); // Connect to the Hardhat Network
        const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
        const deployer = new Wallet(deployerPrivateKey, provider);
        
        const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
        const dai = new ethers.Contract(DAI_ADDRESS, DAI_ABI, provider);
        
        // Add DAI and USDC liquidity to Dex Contract
        const usdc_amount = ethers.utils.parseUnits("1500", USDC_DECIMALS); 
        const usdc_tx = await usdc.connect(deployer).transfer(dexContract.address, usdc_amount);
        await usdc_tx.wait(1);

        const dai_amount = ethers.utils.parseUnits("1500", DAI_DECIMALS); 
        const dai_tx = await dai.connect(deployer).transfer(dexContract.address, dai_amount);
        await dai_tx.wait(1);

        // Transfer DAI to the FlashLoan contract
        const dai_amount1 = ethers.utils.parseUnits("1200", DAI_DECIMALS); 
        const dai_tx1 = await dai.connect(deployer).transfer(simpleFlashLoan.address, dai_amount1);
        await dai_tx1.wait(1);
    })

    describe("after Deployment", function () {
        it("should return USDC balnce of Flash Loan Contract", async function () {
            const usdcBalance = await dexContract.getBalance(USDC_ADDRESS);
            console.log(`USDC balance of the Dex contract is: ${usdcBalance / 1e6} USDC`);

            const daiBalance = await dexContract.getBalance(DAI_ADDRESS);
            console.log(`DAI balance of the Dex contract is: ${daiBalance / 1e18} DAI`);

            const usdcBalance1 = await simpleFlashLoan.getBalance(USDC_ADDRESS);
            console.log(`USDC balance of the FlashLoan contract is: ${usdcBalance1 / 1e6} USDC`);

            const daiBalance1 = await simpleFlashLoan.getBalance(DAI_ADDRESS);
            console.log(`DAI balance of the FlashLoan contract is: ${daiBalance1 / 1e18} DAI`);
        });
    });

     // ***************** Approve Tokens ********************* 
    describe("Approve USDC and DAI from FlashLoan Contract to Dex", async function () {
      it("should approve USDC", async function () {
        await expect(simpleFlashLoan.connect(addr1).approveDAI(ethers.utils.parseUnits("1200", DAI_DECIMALS))).not.to.be.reverted;
      });
      it("should approve DAI", async function () {
        await expect(simpleFlashLoan.connect(addr1).approveUSDC(ethers.utils.parseUnits("1000", USDC_DECIMALS))).not.to.be.reverted;
      });
    });

    describe("Checking Allowance of DAI and USDC", async function () {
        it("should return USDC Allowance", async function () {
          expect(await simpleFlashLoan.allowanceUSDC()).to.equal(ethers.utils.parseUnits("1000", USDC_DECIMALS));
        });
        it("should return DAI Allowance", async function () {
            expect(await simpleFlashLoan.allowanceDAI()).to.equal(ethers.utils.parseUnits("1200", DAI_DECIMALS));
        });
    });

    // ***************** Execute FLASH LOAN ********************* 
    describe("Requesting a flash loan", async function () {
      it("it should success the flash loan request", async function () {
        await expect(simpleFlashLoan.connect(addr1).requestFlashLoan(USDC_ADDRESS, FLASHLOAN_AMOUNT)).not.to.be.reverted;
      });
    });

    
    describe("remaining USDC and DAI", function () {
        it("should return USDC balance of Flash Loan Contract", async function () {
            const remainingUSDC = await simpleFlashLoan.getBalance(USDC_ADDRESS);
            console.log(`Remaining ${remainingUSDC / 1e6} USDC from the FlashLoan contract...`);
        });
        it("should return USDC balance of Flash Loan Contract", async function () {
            const remainingDAI = await simpleFlashLoan.getBalance(DAI_ADDRESS);
            console.log(`Remaining ${remainingDAI / 1e18} DAI from the FlashLoan contract...`);
        });
    });
   

})