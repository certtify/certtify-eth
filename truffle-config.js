/** 
 * Config file for truffle 
 * Options can be found here: http://truffleframework.com/docs/advanced/configuration
 * */
module.exports = {
    networks: {
        official: {
            host: "localhost",
            port: 8545,
            network_id: "*",
            gas: 6500000,
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
