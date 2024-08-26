const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

async function getBestRoute(sellTokenAddress, sellTokenAmount, buyTokenAddress, sender, isPermit, slippageTolerancePercentage) {
    try {
        const response = await axios.get('https://api.portals.fi/v2/portal', {
            params: {
                inputToken: sellTokenAddress,
                inputAmount: sellTokenAmount,
                outputToken: buyTokenAddress,
                sender: sender,
                isPermit: isPermit,
                slippageTolerancePercentage: slippageTolerancePercentage
            },
            headers: {
                Authorization: `Bearer ${process.env.PORTALS_API_KEY}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching route:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function signOrder(signedOrder) {
    const { domain, types, value } = signedOrder;
    console.log('Signing order:', signedOrder);

    const privateKey = process.env.PRIVATE_KEY;
    const wallet = new ethers.Wallet(privateKey);

    const signature = await wallet._signTypedData(domain, types, value);
    console.log('Order signed:', signature);
    return signature;
}

async function executeSignedOrder(orderId, signature) {
    console.log('Executing order:', orderId, signature);
    try {
        const url = `https://api.portals.fi/v2/portal?orderId=${orderId}&signature=${signature}`;

        const response = await axios.post(url, {}, {
            headers: {
                Authorization: `Bearer ${process.env.PORTALS_API_KEY}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error executing order:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function main() {
    const sellTokenAddress = 'bsc:0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
    const sellTokenAmount = '9000000000000000';
    const buyTokenAddress = 'bsc:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';
    const sender = '0x069acF6f57CA7e712b488bfdaa1e9932877E9De6';
    const isPermit = true;
    const slippageTolerancePercentage = 2.5;

    try {
        const routeData = await getBestRoute(sellTokenAddress, sellTokenAmount, buyTokenAddress, sender, isPermit, slippageTolerancePercentage);
        console.log('Route data:', routeData);
        if (routeData.signedOrder) {
            const signature = await signOrder(routeData.signedOrder);
            console.log('Order ID:', routeData.context.orderId);

            const executionResult = await executeSignedOrder(routeData.context.orderId, signature);

            const data = executionResult.tx.data;
            const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            const to = executionResult.tx.to;
            const tx = {
                to: to,
                data: data,
                gasLimit: executionResult.context.gasLimit,
            };
            try {
                const response = await wallet.sendTransaction(tx);
                console.log('Transaction sent:', response);
                console.log('Transaction hash:', response.hash);
            } catch (error) {
                console.error('Error sending transaction:', error.message);
            }
        } else {
            console.log('No signed order available. Please check the transaction data:', routeData);
        }
    } catch (error) {
        console.error('Error in transaction process:', error.message);
    }
}

main();
