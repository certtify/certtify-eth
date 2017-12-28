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
                    var tokenExpected = web3.toBigNumber(web3._extend.utils.toWei(etherSent, 'ether')).div(web3.toBigNumber(web3._extend.utils.toWei(rate, 'wei')));
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
var calEther = function(tokenRequired, rateInWei) {
    return web3._extend.utils.fromWei(web3.toBigNumber(tokenRequired).mul(web3.toBigNumber(web3._extend.utils.toWei(rateInWei, 'wei'))).mul(web3.toBigNumber('1e-18')), 'ether');
}
/**
 * Function for withdrawing founders' token and confirm the operation is successful
 * The following are confirmed,
 *      1. Transaction is executed with no error
 *      2. Founder address is rewarded with expected amount of token
 *      3. Contract address holds expected amount of token
 * Return a Promise which will resolve if all test are passed, or throw if any error occured with the reason stated
 */
var confirmWithdraw = function(instance, tokenInstance, deployerAddress, deployerBal, contractBal) {
    return new Promise(function(resolve, reject) {
        // Call founderWithdraw() to withdraw token
        instance.founderWithdraw().then(function() {
            // Get balanceOf(deployerAddress)
            return tokenInstance.balanceOf(deployerAddress);
        }).then(function(balance) {
            // Assert correct amount of token are withdrawn by founders
            if (balance.cmp(deployerBal) != 0) {
                reject('Number of token rewarded to founders mismatched');
            }
            // Get balanceOf(contract)
            return tokenInstance.balanceOf(instance.address);
        }).then(function(balanceContract) {
            if (balanceContract.cmp(contractBal) != 0) {
                reject('Contract holds incorrect amount of token after founders withdrawn their token in phase 1');
            }
            resolve();
        }).catch(function(err) {
            reject(err);
        });
    });
}
/**
 * Assert an async function will returns 'revert' on EVM upon execution
 * Modified from assertRevert from zeppelin-soldity
 * 
 * Returns a promise which will resolve if revert event is detected, or throw if not
 */
function assertRevert(fn) {
    return new Promise(function(resolve, reject) {
        fn().then(function() {
            reject('Error containing "revert" must be returned');
        }).catch(function(err) {
            if (err.message.search('revert') == -1) {
                // Revert not triggered
                reject('Error containing "revert" must be returned');
            }
            else {
                resolve();
            }
        })
    })
}

contract('CerttifyCrowdsale', function(accounts) {

    const _timestampStage1 = getTimestamp(10);
    const _timestampStage2 = getTimestamp(20);
    const _timestampStage3 = getTimestamp(30);
    const _timestampEndTime = getTimestamp(40); 
    const _weiCostOfTokenStage1 = web3.toBigNumber('10000000000000');
    const _weiCostOfTokenStage2 = web3.toBigNumber('12000000000000');
    const _weiCostOfTokenStage3 = web3.toBigNumber('15000000000000');
    const _wallet = '0x6c2aafbb393d67e7057c34e7c8389e864928361b'; // Just a random address for testing
    const _founderTokenUnlockPhase1 = getTimestamp(50);
    const _founderTokenUnlockPhase2 = getTimestamp(60);
    const _founderTokenUnlockPhase3 = getTimestamp(70);
    const _founderTokenUnlockPhase4 = getTimestamp(80);

    it('Crowdsale contract deployed successfully with all variables set as expected', function(done) {
        var contractVars = null;
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
            promises.push(instance.founderTokenUnlockPhase1.call());
            promises.push(instance.founderTokenUnlockPhase2.call());
            promises.push(instance.founderTokenUnlockPhase3.call());
            promises.push(instance.founderTokenUnlockPhase4.call());
            promises.push(instance.founderTokenWithdrawnPhase1.call());
            promises.push(instance.founderTokenWithdrawnPhase2.call());
            promises.push(instance.founderTokenWithdrawnPhase3.call());
            promises.push(instance.founderTokenWithdrawnPhase4.call());
            promises.push(instance.founderWithdrawablePhase1.call());
            promises.push(instance.founderWithdrawablePhase2.call());
            promises.push(instance.founderWithdrawablePhase3.call());
            promises.push(instance.founderWithdrawablePhase4.call());
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
            // Verify wei rate is converted into wei rate correctly
            var rateStage1 = contractVars[8].valueOf();
            assert.equal(rateStage1, web3._extend.utils.toWei(_weiCostOfTokenStage1, 'wei'), "Rate of stage 1 ICO is not set correctly");
            var rateStage2 = contractVars[9].valueOf();
            assert.equal(rateStage2, web3._extend.utils.toWei(_weiCostOfTokenStage2, 'wei'), "Rate of stage 2 ICO is not set correctly");
            var rateStage3 = contractVars[10].valueOf();
            assert.equal(rateStage3, web3._extend.utils.toWei(_weiCostOfTokenStage3, 'wei'), "Rate of stage 3 ICO is not set correctly");
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
            var founderTokenUnlockPhase1 = contractVars[17].valueOf();
            assert.equal(founderTokenUnlockPhase1.valueOf(), _founderTokenUnlockPhase1, "Phase 1 unlock time of founders' token is not set correctly");
            var founderTokenUnlockPhase2 = contractVars[18].valueOf();
            assert.equal(founderTokenUnlockPhase2.valueOf(), _founderTokenUnlockPhase2, "Phase 2 unlock time of founders' token is not set correctly");
            var founderTokenUnlockPhase3 = contractVars[19].valueOf();
            assert.equal(founderTokenUnlockPhase3.valueOf(), _founderTokenUnlockPhase3, "Phase 3 unlock time of founders' token is not set correctly");
            var founderTokenUnlockPhase4 = contractVars[20].valueOf();
            assert.equal(founderTokenUnlockPhase4.valueOf(), _founderTokenUnlockPhase4, "Phase 4 unlock time of founders' token is not set correctly");
            var founderTokenWithdrawnPhase1 = contractVars[21].valueOf();
            assert(!founderTokenWithdrawnPhase1, "Founders' token withdrawn status in phase 1 is not false by default");
            var founderTokenWithdrawnPhase2 = contractVars[22].valueOf();
            assert(!founderTokenWithdrawnPhase2, "Founders' token withdrawn status in phase 2 is not false by default");
            var founderTokenWithdrawnPhase3 = contractVars[23].valueOf();
            assert(!founderTokenWithdrawnPhase3, "Founders' token withdrawn status in phase 3 is not false by default");
            var founderTokenWithdrawnPhase4 = contractVars[24].valueOf();
            assert(!founderTokenWithdrawnPhase4, "Founders' token withdrawn status in phase 4 is not false by default");
            var founderWithdrawablePhase1 = contractVars[25].valueOf();
            assert.equal(founderWithdrawablePhase1.valueOf(), 0, "Amount of token withdrawable by founders in phase 1 is not 0 by default");
            var founderWithdrawablePhase2 = contractVars[26].valueOf();
            assert.equal(founderWithdrawablePhase2.valueOf(), 0, "Amount of token withdrawable by founders in phase 2 is not 0 by default");
            var founderWithdrawablePhase3 = contractVars[27].valueOf();
            assert.equal(founderWithdrawablePhase3.valueOf(), 0, "Amount of token withdrawable by founders in phase 3 is not 0 by default");
            var founderWithdrawablePhase4 = contractVars[28].valueOf();
            assert.equal(founderWithdrawablePhase4.valueOf(), 0, "Amount of token withdrawable by founders in phase 4 is not 0 by default");
            done();
        });
    });

    it('Token contract is deployed with lockup set to true', function(done) {
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(instance) {
            return instance.token.call();
        }).then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            return tokenInstance.lockup.call();
        }).then(function(lockup) {
            assert(lockup, 'Token contract is not locked up upon creation');
            done();
        });
    })

    it('Handling a valid pre-sale call', function(done) {
        var instance = null;
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(instance) {
            // Purchase from accounts[1] for 1 ether in stage 1 with calling default function
            purchaseConfirmSale(instance, accounts[1], _wallet, 1, _weiCostOfTokenStage1).then(function() {
                done();
            }).catch(function(err) {
                done(err); // Throw error
            });
        });
    });

    it('Handle a valid public buy token request in stage 2 ICO when the change is caused by timestamp', function(done) {
        // Deploy contract but immediately begin stage 2
        Crowdsale.new(getTimestamp(0), getTimestamp(0), _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(instance) {
            // Purchase from accounts[1] for 1.2 ether in stage 2 with calling default function
            purchaseConfirmSale(instance, accounts[1], _wallet, 1.2, _weiCostOfTokenStage2).then(function() {
                done();
            }).catch(function(err) {
                done(err); // Throw error
            });
        });
    });

    it('Handle a valid public buy token request in stage 3 ICO when the change is caused by timestamp', function(done) {
        // Deploy contract but immediately begin stage 3
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(instance) {
            // Purchase from accounts[1] for 1.2 ether in stage 2 with calling default function
            purchaseConfirmSale(instance, accounts[1], _wallet, 1.5, _weiCostOfTokenStage3).then(function() {
                done();
            }).catch(function(err) {
                done(err); // Throw error
            });
        });
    });

    it('ICO sale is stopped after the current time has passed the end timestamp', function(done) {
        // Deploy contract but immediately end the ICO
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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

    it('ICO stage is automatically changed when cap of current stage is exceeded, cannot sale over MAX_ALLOWED_TOTAL cap, and set the correct amount of tokens that founders could withdraw', function(done) {
        var instance = null;
        var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
        // Deploy contract but immediately begin stage 1
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
            purchaseConfirmSale(instance, accounts[1], _wallet, calEther(maxSupply.mul(STAGE_1_PURCHASE), _weiCostOfTokenStage1), _weiCostOfTokenStage1).then(function() {
                return purchaseConfirmSale(instance, accounts[2], _wallet, calEther(maxSupply.mul(STAGE_1_PURCHASE), _weiCostOfTokenStage1), _weiCostOfTokenStage1);
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
                return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(maxSupply.mul(STAGE_2_PURCHASE), _weiCostOfTokenStage2), _weiCostOfTokenStage2);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[2], _wallet, calEther(maxSupply.mul(STAGE_2_PURCHASE), _weiCostOfTokenStage2), _weiCostOfTokenStage2);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[3], _wallet, calEther(maxSupply.mul(STAGE_2_PURCHASE), _weiCostOfTokenStage2), _weiCostOfTokenStage2);
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
                return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _weiCostOfTokenStage3), _weiCostOfTokenStage3);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[2], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _weiCostOfTokenStage3), _weiCostOfTokenStage3);
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[3], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _weiCostOfTokenStage3), _weiCostOfTokenStage3);
            }).then(function() {
                // Attempt over-buying over the cap with ether enough to buy 4.25% MAX_SUPPLY + 1 wei
                return new Promise(function(resolve, reject) {
                    purchaseConfirmSale(instance, accounts[4], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _weiCostOfTokenStage3).add(1), _weiCostOfTokenStage3).then(function() {
                        reject('ICO sale allow token sale over MAX_ALLOWED_TOTAL');
                        return;
                    }).catch(function(err) {
                        // This is expected due to buying over the cap
                        resolve();
                    });
                });
            }).then(function() {
                return purchaseConfirmSale(instance, accounts[4], _wallet, calEther(maxSupply.mul(STAGE_3_PURCHASE), _weiCostOfTokenStage3), _weiCostOfTokenStage3);
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
                    purchaseConfirmSale(instance, accounts[1], _wallet, calEther(1, _weiCostOfTokenStage3), _weiCostOfTokenStage3).then(function() {
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
             * ICO Founders Withdrawable Token Test
             * 
             * Since all token are sold out, founders should be able to withdraw 25% of MAX_SUPPLY, more specifically,
             *      Phase 1: 10% of MAX_SUPPLY
             *      Phase 2, 3 & 4: 5% of MAX_SUPPLY
             * Here, we only test if founderWithdrawable in each phase is set correctly
             */
            .then(function() {
                return instance.postICO({
                    from: accounts[0]
                });
            }).then(function() {
                var promises = [];
                promises.push(instance.founderWithdrawablePhase1.call());
                promises.push(instance.founderWithdrawablePhase2.call());
                promises.push(instance.founderWithdrawablePhase3.call());
                promises.push(instance.founderWithdrawablePhase4.call());
                return Promise.all(promises);
            }).then(function(founderWithdrawable) {
                // Assert founderWithdrawablePhase1
                var founderWithdrawablePhase1 = founderWithdrawable[0];
                assert(founderWithdrawablePhase1.cmp(maxSupply.mul(0.1)) == 0, 'Amount of token withdrawable by founders in phase 1 is not identical to 10% of all available token');
                // Assert founderWithdrawablePhase2
                var founderWithdrawablePhase2 = founderWithdrawable[1];
                assert(founderWithdrawablePhase2.cmp(maxSupply.mul(0.05)) == 0, 'Amount of token withdrawable by founders in phase 2 is not identical to 5% of all available token');
                // Assert founderWithdrawablePhase3
                var founderWithdrawablePhase3 = founderWithdrawable[2];
                assert(founderWithdrawablePhase3.cmp(maxSupply.mul(0.05)) == 0, 'Amount of token withdrawable by founders in phase 3 is not identical to 5% of all available token');
                // Assert founderWithdrawablePhase4
                var founderWithdrawablePhase4 = founderWithdrawable[3];
                assert(founderWithdrawablePhase4.cmp(maxSupply.mul(0.05)) == 0, 'Amount of token withdrawable by founders in phase 4 is not identical to 5% of all available token');
                done();
            }).catch(function(err) {
                // Some error occured
                done(err);
            });
        });
    });

    it('Cannot request ICO to address(0)', function(done) {
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return getTokenBalance(instance, accounts[5]);
        }).then(function(balanceOriginal) {
            // Get original balance before the invalid purchase
            oriBalance = balanceOriginal;
            return new Promise(function(resolve, reject) {
                // accounts[5] was created with no balance, this should therefore fail
                purchaseConfirmSale(instance, accounts[5], _wallet, 1, _weiCostOfTokenStage1).then(function() {
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

    it('Correct amount of token are set to be withdrawable by founders and rest are burnt when maximum cap is not reached', function(done) {
        var instance = null;
        var tokenInstance = null;
        var founderWithdrawable = null;
        var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
        // Buy 9% of token in the whole ICO
        var tokenBought = maxSupply.mul(web3.toBigNumber(0.09));
        // Founder should be able to withdraw 9%/3 = 3% of token, since they will own 25% of the 12% supply available
        var withdrawableTotal = tokenBought.div(3);
        var withdrawablePhase1 = withdrawableTotal.mul(0.4); // 10%
        var withdrawablePhase2 = withdrawableTotal.mul(0.2); // 5%
        var withdrawablePhase3 = withdrawableTotal.mul(0.2); // 5%
        var withdrawablePhase4 = withdrawableTotal.mul(0.2); // 5%
        // Maximum supply left should be 12% of maxSupply
        var maxSupplyLeft = tokenBought.add(withdrawableTotal);
        // Deploy the contract, immediately start stage 3 ICO
        // Gives ourself 12 seconds to buy the token before testing the function
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0.2), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(tokenBought, _weiCostOfTokenStage3), _weiCostOfTokenStage3);
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
            var promises = [];
            promises.push(instance.founderWithdrawablePhase1.call());
            promises.push(instance.founderWithdrawablePhase2.call());
            promises.push(instance.founderWithdrawablePhase3.call());
            promises.push(instance.founderWithdrawablePhase4.call());
            return Promise.all(promises);
        }).then(function(_founderWithdrawable) {
            founderWithdrawable = _founderWithdrawable;
            // Assert 3% of total supply is withdrawable
            // Phase 1: 3% * 40% = 1.2%; Phase 2, 3 & 4: 3% * 20% = 0.6%
            assert(founderWithdrawable[0].cmp(withdrawablePhase1) == 0, 'Token withdrawable to founders in phase 1 does not equate to 10% of total available supply when maximum cap is not reached');
            assert(founderWithdrawable[1].cmp(withdrawablePhase2) == 0, 'Token withdrawable to founders in phase 2 does not equate to 5% of total available supply when maximum cap is not reached');
            assert(founderWithdrawable[2].cmp(withdrawablePhase2) == 0, 'Token withdrawable to founders in phase 3 does not equate to 5% of total available supply when maximum cap is not reached');
            assert(founderWithdrawable[3].cmp(withdrawablePhase2) == 0, 'Token withdrawable to founders in phase 4 does not equate to 5% of total available supply when maximum cap is not reached');
            var founderWithdrawableTotal = founderWithdrawable[0].add(founderWithdrawable[1]).add(founderWithdrawable[2]).add(founderWithdrawable[3]);
            assert(founderWithdrawableTotal.cmp(withdrawableTotal) == 0, 'Total token withdrawable to founders does not equate to 25% of total available supply when maximum cap is not reached');
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
            // Balance of the contract address should be founderWithdrawable, since it still holds token that is later distributed to owners
            assert(balanceOfContract.cmp(withdrawableTotal) == 0, 'Contract still holds token after the postICO call');
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
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
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

    it('postICO unlock the token lockup', function(done) {
        var instance = null;
        // Deploy contract in end-ico stage
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return instance.postICO();
        }).then(function() {
            return instance.token.call();
        }).then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            return tokenInstance.lockup.call();
        }).then(function(lockup) {
            assert(!lockup, 'Token contract is not locked up upon creation');
            done();
        });
    });

    it('founderWithdraw allow founders to withdraw correct amount of token after lockup of that phase, and cannot be called after all phase are withdrawn', function(done) {
        var instance = null;
        var tokenInstance = null;
        var founderWithdrawable = null;
        var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
        // Buy 9% of token in the whole ICO
        var tokenBought = maxSupply.mul(web3.toBigNumber(0.09));
        // Founder should be able to withdraw 9%/3 = 3% of token, since they will own 25% of the 12% supply available
        var withdrawable = tokenBought.div(3);
        // In phase 1, 40% of withdrawable can be withdrawn
        var withdrawablePhase1 = withdrawable.mul(web3.toBigNumber('0.4'));
        // In phase 2, 20% of withdrawable can be withdrawn
        var withdrawablePhase2 = withdrawable.mul(web3.toBigNumber('0.2'));
        // In phase 3, 20% of withdrawable can be withdrawn
        var withdrawablePhase3 = withdrawable.mul(web3.toBigNumber('0.2'));
        // In phase 4, 20% of withdrawable can be withdrawn
        var withdrawablePhase4 = withdrawable.mul(web3.toBigNumber('0.2'));
        // Deploy the contract, immediately start stage 3 ICO
        // Gives ourself 6 seconds to buy the token before testing the function, and allow founder to withdraw unlocked token from all phase after 12 seconds
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0.1), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, getTimestamp(0.2), getTimestamp(0.2), getTimestamp(0.2), getTimestamp(0.2), {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(tokenBought, _weiCostOfTokenStage3), _weiCostOfTokenStage3);
        }).then(function() {
            // Wait for 10 seconds for ICO to end
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                }, 10 * 1000);
            });
        }).then(function() {
            // Call postICO
            return instance.postICO({
                from: accounts[0]
            });
        }).then(function() {
            // Get token address
            return instance.token.call();
        }).then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            /**
             * Withdraw phase 1 unlocked token
             * 1.2% (3% * 0.4) of token should be withdrawn by founders so far
             */
            var deployerBalance = withdrawablePhase1;
            var contractBalance = withdrawable.sub(deployerBalance);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            /**
             * Withdraw phase 2 unlocked token
             * 1.8% (3% * 0.6) of token should be withdrawn by founders so far
             */
            var deployerBalance = withdrawablePhase1.add(withdrawablePhase2);
            var contractBalance = withdrawable.sub(deployerBalance);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            /**
             * Withdraw phase 3 unlocked token
             * 2.4% (3% * 0.8) of token should be withdrawn by founders so far
             */
            var deployerBalance = withdrawablePhase1.add(withdrawablePhase2).add(withdrawablePhase3);
            var contractBalance = withdrawable.sub(deployerBalance);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            /**
             * Withdraw phase 4 unlocked token
             * 3% of token should be withdrawn by founders
             */
            var deployerBalance = withdrawable;
            var contractBalance = web3.toBigNumber(0);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            // Call founderWithdraw() after all tokens withdrawn, should fail
            return assertRevert(instance.founderWithdraw);
        }).then(function() {
            done();
        }).catch(function(err) {
            done(err);
        });
    });

    it('Cannot founderWithdraw a phase before the unlock time', function(done) {
        var instance = null;
        var tokenInstance = null;
        var maxSupply = web3.toBigNumber('5e26'); // 5e8 * 1e18
        // Buy 9% of token in the whole ICO
        var tokenBought = maxSupply.mul(web3.toBigNumber(0.09));
        // Founder should be able to withdraw 9%/3 = 3% of token, since they will own 25% of the 12% supply available
        var withdrawable = tokenBought.div(3);
        // In phase 1, 40% of withdrawable can be withdrawn
        var withdrawablePhase1 = withdrawable.mul(web3.toBigNumber('0.4'));
        // In phase 2, 20% of withdrawable can be withdrawn
        var withdrawablePhase2 = withdrawable.mul(web3.toBigNumber('0.2'));
        // In phase 3, 20% of withdrawable can be withdrawn
        var withdrawablePhase3 = withdrawable.mul(web3.toBigNumber('0.2'));
        // In phase 4, 20% of withdrawable can be withdrawn
        var withdrawablePhase4 = withdrawable.mul(web3.toBigNumber('0.2'));
        // Deploy the contract, immediately start stage 3 ICO
        // Gives ourself 6 seconds to buy the token before testing the function, and allow founder to withdraw unlocked token
        // Token are unlocked with the following schedule:
        //      Phase 1: 12 Seconds
        //      Phase 2: 18 Seconds
        //      Phase 3: 24 Seconds
        //      Phase 4: 30 Seconds
        var now = getTimestamp(0);
        var icoEnd = getTimestamp(0.1);
        var phase1 = getTimestamp(0.2);
        var phase2 = getTimestamp(0.3);
        var phase3 = getTimestamp(0.4);
        var phase4 = getTimestamp(0.5);
        Crowdsale.new(now, now, now, icoEnd, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, phase1, phase2, phase3, phase4, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(tokenBought, _weiCostOfTokenStage3), _weiCostOfTokenStage3);
        }).then(function() {
            // Get token address
            return instance.token.call();
        }).then(function(tokenAddress) {
            tokenInstance = CerttifyToken.at(tokenAddress);
            var now = getTimestamp(0);
            if (now < icoEnd) {
                // Wait for ICO to end
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve();
                    }, (icoEnd - now) * 1000);
                });
            }
            else {
                return Promise.resolve();
            }
        }).then(function() {
            // Call postICO
            return instance.postICO({
                from: accounts[0]
            });
        }).then(function() {
            // Imemediately call founderWithdraw (phase 1), should fail
            return assertRevert(instance.founderWithdraw);
        }).then(function() {
            // Wait for Phase 1 Unlock
            var now = getTimestamp(0);
            if (now < phase1) {
                // Wait for ICO to end
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve();
                    }, (phase1 - now) * 1000);
                });
            }
            else {
                return Promise.resolve();
            }
        }).then(function() {
            // Phase 1 should be withdrawable now
            var deployerBalance = withdrawablePhase1;
            var contractBalance = withdrawable.sub(deployerBalance);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            // Imemediately call founderWithdraw (phase 2), should fail
            return assertRevert(instance.founderWithdraw);
        }).then(function() {
            // Wait for Phase 2 Unlock
            var now = getTimestamp(0);
            if (now < phase2) {
                // Wait for ICO to end
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve();
                    }, (phase2 - now) * 1000);
                });
            }
            else {
                return Promise.resolve();
            }
        }).then(function() {
            // Phase 2 should be withdrawable now
            var deployerBalance = withdrawablePhase1.add(withdrawablePhase2);
            var contractBalance = withdrawable.sub(deployerBalance);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            // Imemediately call founderWithdraw (phase 3), should fail
            return assertRevert(instance.founderWithdraw);
        }).then(function() {
            // Wait for Phase 3 Unlock
            var now = getTimestamp(0);
            if (now < phase3) {
                // Wait for ICO to end
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve();
                    }, (phase3 - now) * 1000);
                });
            }
            else {
                return Promise.resolve();
            }
        }).then(function() {
            // Phase 3 should be withdrawable now
            var deployerBalance = withdrawablePhase1.add(withdrawablePhase2).add(withdrawablePhase3);
            var contractBalance = withdrawable.sub(deployerBalance);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            // Imemediately call founderWithdraw (phase 4), should fail
            return assertRevert(instance.founderWithdraw);
        }).then(function() {
            // Wait for Phase 4 Unlock
            var now = getTimestamp(0);
            if (now < phase4) {
                // Wait for ICO to end
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve();
                    }, (phase4- now) * 1000);
                });
            }
            else {
                return Promise.resolve();
            }
        }).then(function() {
            // Phase 4 should be withdrawable now
            var deployerBalance = withdrawable;
            var contractBalance = web3.toBigNumber(0);
            return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
        }).then(function() {
            // Call founderWithdraw after all tokens are withdrawn, shoulf fail
            return assertRevert(instance.founderWithdraw);
        }).then(function() {
            done();
        }).catch(function(err) {
            done(err);
        });
    });

    it('founderWithdraw can only be called by contract owner', function(done) {
        var instance = null;
        // Deploy contract with founders' token unlocked already
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, getTimestamp(0), {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return instance.postICO();
        }).then(function() {
            return instance.founderWithdraw({ from: accounts[1] });
        }).then(function() {
            done('No error is thrown when founderWithdraw() is not called by owner');
        }).catch(function(err) {
            done();
        });
    });

    it('founderWithdraw cannot be called before founder token are unlocked', function(done) {
        var instance = null;
        // Deploy contract with founders' token not yet unlocked
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            return instance.postICO();
        }).then(function() {
            return instance.founderWithdraw();
        }).then(function() {
            done('No error is thrown when founderWithdraw() is called before unlock time');
        }).catch(function(err) {
            done();
        });
    });

    it('founderWithdraw cannot be called before postICO is called', function(done) {
        // Deploy contract with founders' token unlocked already
        Crowdsale.new(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), {
            from: accounts[0]
        }).then(function(instance) {
            return instance.founderWithdraw();
        }).then(function() {
            done('No error is thrown when founderWithdraw() is called before postICO is called');
        }).catch(function(err) {
            done();
        });
    })

});