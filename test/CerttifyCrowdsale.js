var Crowdsale = artifacts.require("CerttifyCrowdsale");
var CerttifyToken = artifacts.require("CerttifyToken");

/**
 * Return timestamp in seconds (after delaying for delayInMinutes minutes) since Unix epoch
 */
var getTimestamp = function(delayInMinutes) {
    var d = new Date();
    d.setTime(new Date().getTime() + delayInMinutes * 60 * 1000);
    return Math.floor(d.getTime() / 1000);
}
/**
 * Function for returning the balance of a given address on the token contract
 */
var getTokenBalance = function(instance, address) {
    return new Promise(function(resolve, reject) {
        instance.token.call().then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            tokenInstance.balanceOf.call(address).then(function(balance) {
                resolve(balance);
            });
        }).catch(function(err) {
            reject(err);
        });
    });
}
/**
 * Function for purchasing and then confirming the sale is executed successfully
 * The following are confirmed,
 *      1. Transaction is executed with no error
 *      2. Investor are rewarded with the expected amount of token (etherSent * rate * 1e+18)
 *      3. Fund is sent to address 'wallet'
 *      4. TokenPurchase event is logging the event correctly
 * Return a Promise which will resolve if all test are passed, or throw if any error occured with the reason stated
 */
var purchaseConfirmSale = function(instance, address, wallet, etherSent, rate) {
    return new Promise(function(resolve, reject) {
        var walletBalanceOriginal = web3.eth.getBalance(wallet);
        var addressTokenBalanceOriginal = null;
        // Get balance of address that should receive the tokens before the purchase
        getTokenBalance(instance, address).then(function(_addressTokenBalanceOriginal) {
            addressTokenBalanceOriginal = _addressTokenBalanceOriginal;
            web3.eth.sendTransaction({
                from: address,
                to: instance.address,
                value: web3._extend.utils.toWei(etherSent, 'ether'),
                gas: 500000
            }, function(err, txHash) {
                if (err) {
                    reject('Error occured during ICO purchase transaction');
                    return;
                }
                // Get balance of address that should receive the tokens
                getTokenBalance(instance, address).then(function(balance) {
                    var tokenExpected = web3.toBigNumber(web3._extend.utils.toWei(etherSent, 'ether')).div(web3.toBigNumber(web3._extend.utils.toWei(rate, 'szabo')));
                    var balanceExpected = tokenExpected.mul(web3.toBigNumber('1e+18')).add(addressTokenBalanceOriginal); // Convert into decimal and add back the original balance of that address
                    if (balance.cmp(balanceExpected) != 0) {
                        reject('Balance rewarded to investor does not match the expected balance');
                        return;
                    }
                    // Check ether is transferred to designated wallet, and added to original balance of the address
                    var walletBalance = web3.eth.getBalance(wallet);
                    if (walletBalance.cmp(web3.toBigNumber(web3._extend.utils.toWei(etherSent, 'ether')).add(walletBalanceOriginal)) != 0) {
                        reject('Collected ether is not transferred to designated wallet');
                        return;
                    }
                    // Check TokenPurchase event is logged correctly
                    instance.TokenPurchase().get(function(err, logs) {
                        var event = logs[0].args;
                        // Assert token purchase event is logged correctly
                        if (event.purchaser !== address) {
                            reject('Purchaser is not logged correctly');
                            return;
                        }
                        if (event.beneficiary !== address) {
                            reject('Beneficiary is not logged correctly');
                            return;
                        }
                        if (event.value.cmp(web3._extend.utils.toWei(etherSent, 'ether')) != 0) {
                            reject('ETH value is not logged correctly');
                            return;
                        } 
                        if (event.amount.cmp(balanceExpected.sub(addressTokenBalanceOriginal)) != 0) { 
                            reject('Amount of token bought is not logged correctly');
                            return;
                        }
                        resolve();
                    });
                });
            });
        })
    });
}
/**
 * Function for calculating the amount of ether required to purchase certain amount of token based on the given rate
 */
var calEther = function(tokenRequired, rateInSzabo) {
    return web3._extend.utils.fromWei(web3.toBigNumber(tokenRequired).mul(web3.toBigNumber(web3._extend.utils.toWei(rateInSzabo, 'szabo'))).mul(web3.toBigNumber('1e-18')), 'ether');
}

contract('CerttifyCrowdsale', function(accounts) {

    const _timestampStage1 = getTimestamp(10);
    const _timestampStage2 = getTimestamp(20);
    const _timestampStage3 = getTimestamp(30);
    const _timestampEndTime = getTimestamp(40); 
    const _szaboCostOfTokenStage1 = 10;
    const _szaboCostOfTokenStage2 = 12;
    const _szaboCostOfTokenStage3 = 15;
    const _wallet = '0x6c2aafbb393d67e7057c34e7c8389e864928361b'; // Just a random address for testing

    it('Crowdsale contract deployed successfully with all variables set as expected', function(done) {
        var contractVars = null;
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(instance) {
            // Get all public contract variables
            var promises = [];
            promises.push(instance.token.call());
            promises.push(instance.startTimeStage0.call());
            promises.push(instance.startTimeStage1.call());
            promises.push(instance.startTimeStage2.call());
            promises.push(instance.startTimeStage3.call());
            promises.push(instance.endTime.call());
            promises.push(instance.wallet.call());
            promises.push(instance.contractOwner.call());
            promises.push(instance.rateStage1.call());
            promises.push(instance.rateStage2.call());
            promises.push(instance.rateStage3.call());
            promises.push(instance.MAX_ALLOWED_PRE_SALE.call());
            promises.push(instance.MAX_ALLOWED_BY_STAGE_1.call());
            promises.push(instance.MAX_ALLOWED_BY_STAGE_2.call());
            promises.push(instance.MAX_ALLOWED_TOTAL.call());
            promises.push(instance.weiRaised.call());
            promises.push(instance.tokenSold.call());
            return Promise.all(promises);
        }).then(function(_contractVars) {
            // Verify all contract variable one-by-one
            contractVars = _contractVars;
            // Verify the CerttifyToken is deployed
            var tokenAddress = contractVars[0];
            var tokenInstance = CerttifyToken.at(tokenAddress);
            assert.isNotNull(tokenInstance, null, "Crowdsale contract did not deploy the CerttifyToken contact");
            // Verrify that timestamps are set correctly
            var startPresale = contractVars[1].valueOf();
            var currentTime = Date.now();
            assert(currentTime > startPresale.valueOf() * 1000, "Crowdsale pre-sale did not begin immediately");
            var startStage1 = contractVars[2].valueOf();
            assert.equal(startStage1, _timestampStage1, "Start time of stage 1 ICO is not set correctly");
            var startStage2 = contractVars[3].valueOf();
            assert.equal(startStage2, _timestampStage2, "Start time of stage 2 ICO is not set correctly");
            var startStage3 = contractVars[4].valueOf();
            assert.equal(startStage3, _timestampStage3, "Start time of stage 3 ICO is not set correctly");
            var endICO = contractVars[5].valueOf();
            assert.equal(endICO, _timestampEndTime, "End time of ICO is not set correctly");
            // Verify ETH collection address and owner is set
            var ethWallet = contractVars[6];
            assert.equal(ethWallet, _wallet, "ETH collection wallet is not set correctly");
            var owner = contractVars[7];
            assert.equal(owner, accounts[0], "Contract owner is not set correctly");
            // Verify szabo rate is converted into wei rate correctly
            var rateStage1 = contractVars[8].valueOf();
            assert.equal(rateStage1, web3._extend.utils.toWei(_szaboCostOfTokenStage1, 'szabo'), "Rate of stage 1 ICO is not set correctly");
            var rateStage2 = contractVars[9].valueOf();
            assert.equal(rateStage2, web3._extend.utils.toWei(_szaboCostOfTokenStage2, 'szabo'), "Rate of stage 2 ICO is not set correctly");
            var rateStage3 = contractVars[10].valueOf();
            assert.equal(rateStage3, web3._extend.utils.toWei(_szaboCostOfTokenStage3, 'szabo'), "Rate of stage 3 ICO is not set correctly");
            // Verify cap of each stage is set correctly
            var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
            var capPreSale = contractVars[11].valueOf();
            assert.equal(capPreSale, maxSupply.mul(0.05), "Pre-sale cap is not set correctly");
            var capStage1 = contractVars[12].valueOf();
            assert.equal(capStage1, maxSupply.mul(0.25), "Stage-1 cap is not set correctly");
            var capStage2 = contractVars[13].valueOf();
            assert.equal(capStage2, maxSupply.mul(0.5), "Stage-2 cap is not set correctly");
            var capStage3 = contractVars[14].valueOf();
            assert.equal(capStage3, maxSupply.mul(0.75), "Stage-3 cap is not set correctly");
            // Verify weiRaised and tokenSold is 0 before we do anything with it
            var weiRaised = contractVars[15].valueOf();
            assert.equal(weiRaised, 0, "Initial weiRaised is not 0");
            var tokenSold = contractVars[16].valueOf();
            assert.equal(tokenSold, 0, "Initial tokenSold is not 0");
            done();
        });
    });

    it('Handling a valid pre-sale call', function(done) {
        var instance = null;
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            // Legit pre-sale function call, buy 10000 Certtify token in pre-sale to accounts[1], called by contractOwner
            return instance.buyTokensPreSale(accounts[1], web3.toBigNumber('1e+22'), {
                from: accounts[0]
            });
        }).then(function() {
            // Get Certtify token instance
            return instance.token.call();
        }).then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            // Get balance of accounts[1] that should receive 1e+22 token from the pre-sale call
            return tokenInstance.balanceOf.call(accounts[1]);
        }).then(function(balance) {
            // Assert balance to be 1e+22 token
            assert.equal(balance.valueOf(), web3.toBigNumber('1e+22'), "Pre-sale does not transfer the token to destination");
            // Check if tokenSold is updated
            return instance.tokenSold.call();
        }).then(function(tokenSold) {
            assert.equal(tokenSold.valueOf(), web3.toBigNumber('1e+22'), "Pre-sale does not update tokenSold");
            instance.TokenPurchase().get(function(err, logs) {
                var event = logs[0].args;
                // Assert token purchase event is logged correctly
                assert.equal(event.purchaser, accounts[1], 'Purchaser of pre-sale is not logged as address(0)');
                assert.equal(event.beneficiary, accounts[1], 'Beneficiary of pre-sale not logged correctly');
                assert.equal(event.value.valueOf(), 0, 'ETH value of pre-sale not logged correctly');
                assert.equal(event.amount.valueOf(), web3.toBigNumber('1e+22'), 'Amount of token bought is not logged correctly in pre-sale');
                done();
            });
        });
    });

    it('Pre-sale can at most sale up to MAX_ALLOWED_PRE_SALE', function(done) {
        var instance = null;
        var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
        var maxPreSale = maxSupply.mul(0.05); // 5% of max supply
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            // Buy 50% of pre-sale max cap in 2 transactions, both should be valid
            var promises = [];
            promises.push(instance.buyTokensPreSale(accounts[1], maxPreSale.mul(0.5), {
                from: accounts[0]
            }));
            promises.push(instance.buyTokensPreSale(accounts[2], maxPreSale.mul(0.5), {
                from: accounts[0]
            }));
            return Promise.all(promises);
        }).then(function() {
            // Get Certtify token instance
            return instance.token.call();
        }).then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            var promises = [];
            // Get balance of accounts[1], and accounts[2] that should receive 50% of max token from the pre-sale call
            promises.push(tokenInstance.balanceOf.call(accounts[1]));
            promises.push(tokenInstance.balanceOf.call(accounts[2]));
            return Promise.all(promises);
        }).then(function(balances) {
            // Assert balance of accounts[1] and accounts[2]
            assert.equal(balances[0].valueOf(), maxPreSale.mul(0.5), "Pre-sale function did not reward token correctly when called repeatly");
            assert.equal(balances[1].valueOf(), maxPreSale.mul(0.5), "Pre-sale function did not reward token correctly when called repeatly");
            // Sell one more token, this should be invalid
            return instance.buyTokensPreSale(accounts[3], 1, {
                from: accounts[0]
            });
        }).catch(function(err) {
            // This should fail
            done()
        });
    });

    it('Only contract owner can execute pre-sale function', function(done) {
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            return _instance.buyTokensPreSale(accounts[1], 1, {
                from: accounts[2]
            });
        }).catch(function(err) {
            // This should fail
            done();
        });
    });

    it('Cannot pre-sale to address(0)', function(done) {
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            return _instance.buyTokensPreSale('0x0000000000000000000000000000000000000000', 1, {
                from: accounts[0]
            });
        }).catch(function(err) {
            // This should fail
            done();
        });
    });

    it('Cannot pre-sale negative amount of tokens', function(done) {
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            return _instance.buyTokensPreSale(accounts[1], web3.toBigNumber('-1e+18'), {
                from: accounts[0]
            });
        }).catch(function(err) {
            // This should fail
            done();
        });
    });

    it('Cannot pre-sale after stage-1 is launched', function(done) {
        // Deploy contract but immediately begin stage 1
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            return _instance.buyTokensPreSale(accounts[1], 1, {
                from: accounts[0]
            });
        }).catch(function(err) {
            // This should fail
            done();
        });
    });

    it('Handle a valid public buy token request in stage 1 ICO', function(done) {
        // Deploy contract but immediately begin stage 1
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(instance) {
            // Purchase from accounts[1] for 1 ether in stage 1 with calling default function
            purchaseConfirmSale(instance, accounts[1], _wallet, 1, _szaboCostOfTokenStage1).then(function() {
                done();
            }).catch(function(err) {
                done(err); // Throw error
            });
        });
    });

    it('Handle a valid public buy token request in stage 2 ICO when the change is caused by timestamp', function(done) {
        // Deploy contract but immediately begin stage 2
        Crowdsale.new(getTimestamp(0), getTimestamp(0), _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(instance) {
            // Purchase from accounts[1] for 1.2 ether in stage 2 with calling default function
            purchaseConfirmSale(instance, accounts[1], _wallet, 1.2, _szaboCostOfTokenStage2).then(function() {
                done();
            }).catch(function(err) {
                done(err); // Throw error
            });
        });
    });

    it('Handle a valid public buy token request in stage 3 ICO when the change is caused by timestamp', function(done) {
        // Deploy contract but immediately begin stage 3
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(instance) {
            // Purchase from accounts[1] for 1.2 ether in stage 2 with calling default function
            purchaseConfirmSale(instance, accounts[1], _wallet, 1.5, _szaboCostOfTokenStage3).then(function() {
                done();
            }).catch(function(err) {
                done(err); // Throw error
            });
        });
    });

    it('ICO sale is stopped after the current time has passed the end timestamp', function(done) {
        // Deploy contract but immediately end the ICO
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            var contractAddress = _instance.address;
            // Purchase with calling default function
            web3.eth.sendTransaction({
                from: accounts[1],
                to: contractAddress,
                value: web3._extend.utils.toWei(1, 'ether'),
                gas: 500000
            }, function(err, txHash) {
                assert.isNotNull(err, "ICO did not end after the end timestamp");
                done();
            });
        });
    });

    it('ICO stage is automatically changed when cap of current stage is exceeded, cannot sale over MAX_ALLOWED_TOTAL cap, and allow founders to extract expected amount of tokens afterward', function(done) {
        var instance = null;
        var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
        // Deploy contract but immediately begin stage 1
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            const STAGE_1_PURCHASE = web3.toBigNumber(0.125);
            const STAGE_2_PURCHASE = web3.toBigNumber(0.11);
            const STAGE_3_PURCHASE = web3.toBigNumber(0.0425);
            /**
             * Stage 1 ICO Purchases Test
             * 
             * Max cap of stage 1 ICO is 25% of MAX_SUPPLY
             * Here, we make 2 purchase, each with 12.5% of MAX_SUPPLY, and should reach the cap of stage 1
             */
            purchaseConfirmSale(instance, accounts[1], _wallet, calEther(maxSupply.mul(STAGE_1_PURCHASE), _szaboCostOfTokenStage1), _szaboCostOfTokenStage1).then(function() {
                return purchaseConfirmSale(instance, accounts[2], _wallet, calEther(maxSupply.mul(STAGE_1_PURCHASE), _szaboCostOfTokenStage1), _szaboCostOfTokenStage1);
            })
            /**
             * Stage 2 ICO Purchase Test
             * 
             * Stage 1 ICO should be closed at this point since its cap is reached
             * Max cap of stage 2 is also 25% of MAX_SUPPLY
             * Here, we make 3 purchases, each with 11% of MAX_SUPPLY, and should over-exceed the cap of stage 2
             * [ 0% --> 11% --> 22% --> 33% (Over-bought stage 2) ]
             * 
             * We expect all 3 transaction to go through at the rate of stage 2 ICO
             * This is therefore test whether,
             *      1. Stage is shifted when cap is perfectly matched (in stage 1)
             *      2. Rate is working as expected (use the rate of last stage in case of over-bought)
             */
            .then(function() {
                return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(maxSupply.mul(STAGE_2_PURCHASE), _szaboCostOfTokenStage2), _szaboCostOfTokenStage2);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[2], _wallet, calEther(maxSupply.mul(STAGE_2_PURCHASE), _szaboCostOfTokenStage2), _szaboCostOfTokenStage2);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[3], _wallet, calEther(maxSupply.mul(STAGE_2_PURCHASE), _szaboCostOfTokenStage2), _szaboCostOfTokenStage2);
            })
            /**
             * Stage 3 ICO Purchase Test
             * 
             * Stage 2 ICO should be closed as its cap is blow off
             * 
             * Max cap of stage 3 is originally 25% of MAX_SUPPLY
             * However, since the last stage is over-bought for 33% - 25% = 8%
             * Actual cap for stage 3 should be only 25% - 8% = 17% of MAX_SUPPLY
             * 
             * Here we make 4 purchases, each with 4.25% of MAX_SUPPLY, which should just met the cap
             * All 4 transactions should go through with rate of stage 3 ICO
             * One more purcahses with 4.25% + 1 token will be made before the final purchase to test if it is possible to buy over the set MAX_ALLOWED_TOTAL cap
             * 
             * This therefore test for,
             *      1. Stage is shifted when cap is over-bought (in stage 2)
             *      2. ICO sale will not exceed the setting set by MAX_ALLOWED_TOTAL
             */
            .then(function() {
                return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _szaboCostOfTokenStage3), _szaboCostOfTokenStage3);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[2], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _szaboCostOfTokenStage3), _szaboCostOfTokenStage3);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[3], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _szaboCostOfTokenStage3), _szaboCostOfTokenStage3);
            }).then(function() {
                // Attempt over-buying over the cap with ether enough to buy 4.25% MAX_SUPPLY + 1 wei
                return new Promise(function(resolve, reject) {
                    purchaseConfirmSale(instance, accounts[4], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _szaboCostOfTokenStage3).add(1), _szaboCostOfTokenStage3).then(function() {
                        reject('ICO sale allow token sale over MAX_ALLOWED_TOTAL');
                        return;
                    }).catch(function(err) {
                        // This is expected due to buying over the cap
                        resolve();
                    });
                });
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[4], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _szaboCostOfTokenStage3), _szaboCostOfTokenStage3);
            })
            /**
             * ICO Close Test
             * 
             * Since cap of stage 3 is reached, it should no longer accept any more ether
             * This therefore test for whether ICO is ended if the max cap is reached, and hasEnded() returns true
             */
            .then(function() {
                // Encapsulate this call since we are expecting an error to be throw instead of being resolved
                return new Promise(function(resolve, reject) {
                    purchaseConfirmSale(instance, accounts[1], _wallet, calEther(1, _szaboCostOfTokenStage3), _szaboCostOfTokenStage3).then(function() {
                        reject('ICO did not end after MAX_SUPPLY is sold');
                        return;
                    }).catch(function(err) {
                        resolve();
                    });
                });
            }).then(function() {
                return instance.hasEnded.call();
            }).then(function(ended) {
                assert(ended, 'hasEnded() did not return true when maximum cap is reached');
            })
            /**
             * ICO Founders Extract Test
             * 
             * Since all token are sold out, founders should be able to withdraw 25% of MAX_SUPPLY
             * Here, we only test that we could withdraw token from the function
             * Detailed test are conducted below
             */
            .then(function() {
                return instance.postICO({
                    from: accounts[0]
                });
            }).then(function() {
                // Get token balance of contract owner
                return getTokenBalance(instance, accounts[0]);
            }).then(function(balance) {
                // Assert balance
                assert(balance.cmp(maxSupply.mul(0.25)) == 0, 'Amount of token withdraw by founders is not identical to 25% of all available token');
                done();
            }).catch(function(err) {
                // Some error occured
                done(err);
            });
        });
    });

    it('Cannot request ICO to address(0)', function(done) {
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(instance) {
            return instance.buyTokens('0x0000000000000000000000000000000000000000', {
                from: accounts[1],
                gas: 500000,
                value: web3._extend.utils.toWei(1, 'ether')
            });
        }).then(function() {
            done('ICO request to address(0) does not result in error')
        }).catch(function(err) {
            // This should fail
            done();
        });
    });

    it('Cannot buy token with 0 wei sent', function(done) {
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(instance) {
            web3.eth.sendTransaction({
                from: accounts[1],
                to: instance.address,
                value: 0,
                gas: 500000
            }, function(err, txHash) {
                if (err) {
                    done();
                }
                else {
                    done('0 wei ICO request does not result in error');
                }
            });
        });
    });

    it('Cannot buy token using more ETH than the purchaser owns', function(done) {
        var instance = null;
        var oriBalance = null;
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return getTokenBalance(instance, accounts[5]);
        }).then(function(balanceOriginal) {
            // Get original balance before the invalid purchase
            oriBalance = balanceOriginal;
            return new Promise(function(resolve, reject) {
                // accounts[5] was created with no balance, this should therefore fail
                purchaseConfirmSale(instance, accounts[5], _wallet, 1, _szaboCostOfTokenStage1).then(function() {
                    reject('Purchaser purchase tokens with more Ether than what he owned');
                    return;
                }).catch(function() {
                    // Expect an error
                    resolve();
                });
            });
        }).then(function() {
            return getTokenBalance(instance, accounts[5]);
        }).then(function(balance) {
            assert(balance.cmp(oriBalance) == 0, 'Purchaser purchase tokens with more Ether than what he owned');
            done();
        }).catch(function(err) {
            done(err)
        });
    });

    it('Correct amount of token are withdraw by founders and rest are burnt when maximum cap is not reached', function(done) {
        var instance = null;
        var tokenInstance = null;
        var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
        // Buy 9% of token in the whole ICO
        var tokenBought = maxSupply.mul(web3.toBigNumber(0.09));
        // Founder should be able to withdraw 9%/3 = 3% of token, since they will own 25% of the 12% supply available
        var withdrawable = tokenBought.div(3);
        // Maximum supply left should be 12% of maxSupply
        var maxSupplyLeft = tokenBought.add(withdrawable);
        // Deploy the contract, immediately start stage 3 ICO
        // Gives ourself 12 seconds to buy the token before testing the function
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0.2), _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(tokenBought, _szaboCostOfTokenStage3), _szaboCostOfTokenStage3);
        }).then(function() {
            // Wait for 10 seconds for ICO to end
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                }, 10 * 1000);
            });
        }).then(function() {
            // Force mine a block before calling hasEnded() to update block.timestamp
            // This is relevant in testrpc since no next block will be mined without a transaction
            return new Promise(function(resolve, reject) {
                web3.eth.sendTransaction({
                    from: accounts[0],
                    to: accounts[1],
                    value: 1
                }, function(err, txHash) {
                    resolve();
                });
            });
        }).then(function() {
            // Get hasEnded
            return instance.hasEnded.call();
        }).then(function(hasEnded) {
            // Assert ICO has ended
            assert(hasEnded, 'ICO did not end after end timestamp');
            // Call postICO
            return instance.postICO({
                from: accounts[0]
            });
        }).then(function() {
            // Get the balance of accounts[0]
            return getTokenBalance(instance, accounts[0]);
        }).then(function(balance) {
            // Assert owner get 3% of total supply
            assert(balance.cmp(withdrawable) == 0, 'Token withdrawable to founders does not equate to 25% of total available supply when maximum cap is not reached');
            // Get token address
            return instance.token.call();
        }).then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            // Get total supply of the token
            return tokenInstance.totalSupply.call();
        }).then(function(totalSupplyAfterBurn) {
            assert(totalSupplyAfterBurn.cmp(maxSupplyLeft) == 0, 'Total supply after token burn did not match the expected value');
            // Get the balance of the contract
            return getTokenBalance(instance, instance.address);
        }).then(function(balanceOfContract) {
            // Balance of the contract address should be 0 since all remaining token are burnt
            assert(balanceOfContract.cmp(0) == 0, 'Contract still holds token after the postICO call');
            // Test if postICO can be called after a successful call
            return instance.postICO({
                from: accounts[0]
            });
        }).then(function() {
            done('postICO can be called after a successful call');
        }).catch(function() {
            done();
        });
    });

    it('postICO can only be called by contract owner', function(done) {
        var instance = null;
        // Deploy contract in end-ico stage
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            // Get hasEnded
            return instance.hasEnded.call();
        }).then(function(hasEnded) {
            // Assert ICO has ended
            assert(hasEnded, 'ICO did not end after end timestamp');
            // Call postICO from another address
            return instance.postICO({
                from: accounts[1]
            });
        }).then(function() {
            done('postICO can be called by people other than contract owner');
        }).catch(function() {
            done();
        });
    });

    it('postICO cannot be called before ICO is over', function(done) {
        var instance = null;
        // Deploy contract in end-ico stage
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), _timestampEndTime, _szaboCostOfTokenStage1, _szaboCostOfTokenStage2, _szaboCostOfTokenStage3, _wallet, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            // Get hasEnded
            return instance.hasEnded.call();
        }).then(function(hasEnded) {
            // Assert ICO has ended
            assert(!hasEnded, 'ICO end before end timestamp');
            // Call postICO from another address
            return instance.postICO({
                from: accounts[0]
            });
        }).then(function() {
            done('postICO can be called before ICO is over');
        }).catch(function() {
            done();
        });
    });

});