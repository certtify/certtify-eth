var Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer) {
	// Deploy Migrations contact first
	deployer.deploy(Migrations);
};
