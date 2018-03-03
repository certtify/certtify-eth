const CerttifyCrowdsale = artifacts.require('contracts/CerttifyCrowdsale.sol');

module.exports = function(deployer, network, accounts) {
    const startStage1 = 1523145600; // 2018 Apr 08 00:00 GMT
    const startStage2 = 1524355200; // 2018 Apr 22 00:00 GMT
    const startStage3 = 1525564800; // 2018 May 06 00:00 GMT
    const endICO = 1526774400; // 2018 May 20 00:00 GMT
    // 20% bouns, 1 ETH: 48,000 CTF
    const weiCostStage1 = web3.toBigNumber(web3._extend.utils.toWei(1, 'ether')).div(web3.toBigNumber(48000));
    // 10% bouns, 1 ETH: 44,000 CTF
    const weiCostStage2 = web3.toBigNumber(web3._extend.utils.toWei(1, 'ether')).div(web3.toBigNumber(44000));
     // 1 ETH: 40,000 CTF
    const weiCostStage3 = web3.toBigNumber(web3._extend.utils.toWei(1, 'ether')).div(web3.toBigNumber(40000));
    const wallet = '0x102a7ce6f5755be0730f3ecfb05b8bfbe26e37c7';
    const owner = "0x7e88309Bc199E8D83FdD8E7b8465068d6d83de53";
    const bountyAdmin = "0x7126CB446EA014805ec56E5b620AFC41039c1958";
    const founderUnlockPhase1 = 1533081600; // 2018 Aug 01 00:00 GMT
    const founderUnlockPhase2 = 1554681600; // 2019 Apr 08 00:00 GMT
    const founderUnlockPhase3 = 1586304000; // 2020 Apr 08 00:00 GMT
    const founderUnlockPhase4 = 1617840000; // 2021 Apr 08 00:00 GMT
    deployer.deploy(CerttifyCrowdsale, startStage1, startStage2, startStage3, endICO, 
        weiCostStage1, weiCostStage2, weiCostStage3,
        wallet, owner, bountyAdmin,
        founderUnlockPhase1, founderUnlockPhase2, founderUnlockPhase3, founderUnlockPhase4
    );
};