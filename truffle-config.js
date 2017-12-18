/** 
 * Config file for truffle 
 * Options can be found here: http://truffleframework.com/docs/advanced/configuration
 * */
module.exports = {
    networks: {
        private: {
            host: "localhost",
            port: 8545,
            network_id: "*"
        }
    }
};
