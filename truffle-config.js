/** 
 * Config file for truffle 
 * Options can be found here: http://truffleframework.com/docs/advanced/configuration
 * */

var HDWalletProvider = require('truffle-hdwallet-provider');

var infura_key = "";
var mnemonic = "";

module.exports = {
    networks: {
        rinkeby: {
			provider: new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/" + infura_key),
			network_id: 4,
			gas: 6500000,
            gasPrice: 1000000000
		},
		mainnet: {
			provider: new HDWalletProvider(mnemonic, "https://mainnet.infura.io/" + infura_key),
			network_id: 1,
			gas: 6000000,
            gasPrice: 1000000000
		},
        private: {
            host: "localhost",
            port: 8545,
            network_id: "*"
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};
