const CerttifyCrowdsale = artifacts.require('contracts/CerttifyCrowdsale.sol');

module.exports = function(deployer, network, accounts) {
    const startStage1 = 1518739200; // 2018 Feb 16 00:00 GMT
    const startStage2 = 1520812800; // 2018 Mar 12 00:00 GMT
    const startStage3 = 1523232000; // 2018 Apr 09 00:00 GMT
    const endICO = 1523750400; // 2018 Apr 15 00:00 GMT
    // 20% bouns, 1 ETH: 96,000 CTF
    const weiCostStage1 = web3.toBigNumber(web3._extend.utils.toWei(1, 'ether')).div(web3.toBigNumber(96000));
    // 10% bouns, 1 ETH: 88,000 CTF
    const weiCostStage2 = web3.toBigNumber(web3._extend.utils.toWei(1, 'ether')).div(web3.toBigNumber(88000));
     // 1 ETH: 80,000 CTF
    const weiCostStage3 = web3.toBigNumber(web3._extend.utils.toWei(1, 'ether')).div(web3.toBigNumber(80000));
    const wallet = '0x0AB00ec2b49EE42b09aee64f64f7E20804DC8960';
    const founderUnlockPhase1 = 1538352000; // 2018 Oct 01 00:00 GMT
    const founderUnlockPhase2 = 1569888000; // 2019 Oct 01 00:00 GMT
    const founderUnlockPhase3 = 1601510400; // 2020 Oct 01 00:00 GMT
    const founderUnlockPhase4 = 1633046400; // 2021 Oct 01 00:00 GMT
    deployer.deploy(CerttifyCrowdsale, startStage1, startStage2, startStage3, endICO, 
        weiCostStage1, weiCostStage2, weiCostStage3,
        wallet, founderUnlockPhase1, founderUnlockPhase2, founderUnlockPhase3, founderUnlockPhase4
    );
};