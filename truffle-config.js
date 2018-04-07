/** 
 * Config file for truffle 
 * Options can be found here: http://truffleframework.com/docs/advanced/configuration
 * */

var HDWalletProvider = require('truffle-hdwallet-provider');

var infura_key = "";
var mnemonic = "";

module.exports = {
    networks: {
        ropsten: {
			provider: new HDWalletProvider(mnemonic, "https://ropsten.infura.io/" + infura_key),
			network_id: 3,
			gas: 300000,
            gasPrice: 20000000000
		},
		mainnet: {
			provider: new HDWalletProvider(mnemonic, "https://mainnet.infura.io/" + infura_key),
			network_id: 1,
			gas: 300000,
            gasPrice: 20000000000
		},
        private: {
            host: "localhost",
            port: 8545,
            network_id: "*"
        },
        coverage: {
            host: "localhost",
            port: 8545,
            network_id: "*",
            gas: 80000000
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};
