const CerttifyCrowdsale = artifacts.require('contracts/CerttifyCrowdsale.sol');

module.exports = function(deployer) {
    const wallet = '0x102a7ce6f5755be0730f3ecfb05b8bfbe26e37c7';
    const owner = "0x7e88309Bc199E8D83FdD8E7b8465068d6d83de53";
    const bountyAdmin = "0x7126CB446EA014805ec56E5b620AFC41039c1958";
    deployer.deploy(CerttifyCrowdsale, wallet, owner, bountyAdmin, {
        gas: 4600000
    });
};