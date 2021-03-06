var Crowdsale = artifacts.require("CerttifyCrowdsale");
var CerttifyToken = artifacts.require("CerttifyToken");
var Bounty = artifacts.require("Bounty");

contract('CerttifyCrowdsale', function(accounts) {

    /**
     * Return timestamp in seconds (after delaying for delayInMinutes minutes) since Unix epoch
     * @param {number} delayInMinutes Number of minutes to be delayed
     */
    var getTimestamp = function(delayInMinutes) {
        var d = new Date();
        d.setTime(new Date().getTime() + delayInMinutes * 60 * 1000);
        return Math.floor(d.getTime() / 1000);
    }
    
    /**
     * Function for returning the balance of a given address on the token contract
     * @param {*} instance Crowdsale contract instance
     * @param {string} address Address to be queried
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
     * Assert a promise will returns 'revert' on EVM upon execution
     * @param {Promise<any>} promise Operation that should be reverted
     */
    function assertRevert(promise) {
        return new Promise(function(resolve, reject) {
            promise.then(function() {
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

    // Default Variables
    const _timestampStage1 = getTimestamp(10);
    const _timestampStage2 = getTimestamp(20);
    const _timestampStage3 = getTimestamp(30);
    const _timestampEndTime = getTimestamp(40); 
    const _weiCostOfTokenStage1 = web3.toBigNumber('10000000000000');
    const _weiCostOfTokenStage2 = web3.toBigNumber('12000000000000');
    const _weiCostOfTokenStage3 = web3.toBigNumber('15000000000000');
    const _wallet = '0x6c2aafbb393d67e7057c34e7c8389e864928361b'; // Just a random address for testing
    const _owner = accounts[0];
    const _bountyAdmin = accounts[1];
    const _founderTokenUnlockPhase1 = getTimestamp(50);
    const _founderTokenUnlockPhase2 = getTimestamp(60);
    const _founderTokenUnlockPhase3 = getTimestamp(70);
    const _founderTokenUnlockPhase4 = getTimestamp(80);

    describe('Before ICO Specification Confirmation', function() {

        var instance = null;

        beforeEach(function(done) {
            Crowdsale.new(_wallet, _owner, _bountyAdmin, {
                from: accounts[1]
            }).then(function(_instance) {
                instance = _instance;
                done();
            });
        });

        it('Crowdsale contract deployed successfully with variables set as expected', function(done) {
            var contractVars = null;
            const maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            // Get public contract variables
            var promises = [];
            promises.push(instance.token.call());
            promises.push(instance.wallet.call());
            promises.push(instance.owner.call());
            promises.push(instance.MAX_ALLOWED_PRE_SALE.call());
            promises.push(instance.MAX_ALLOWED_BY_STAGE_1.call());
            promises.push(instance.MAX_ALLOWED_BY_STAGE_2.call());
            promises.push(instance.MAX_ALLOWED_TOTAL.call());
            promises.push(instance.weiRaised.call());
            promises.push(instance.tokenSold.call());
            promises.push(instance.icoSpecConfirmed.call());
            promises.push(instance.startTimeStage1.call());
            Promise.all(promises).then(function(_contractVars) {
                // Verify all contract variable one-by-one
                contractVars = _contractVars;
                // Verify the CerttifyToken is deployed
                var tokenAddress = contractVars[0];
                var tokenInstance = CerttifyToken.at(tokenAddress);
                assert.isNotNull(tokenInstance, null, "Crowdsale contract did not deploy the CerttifyToken contact");
                // Verify ETH collection address and owner is set
                var ethWallet = contractVars[1];
                assert.equal(ethWallet, _wallet, "ETH collection wallet is not set correctly");
                var owner = contractVars[2];
                assert.equal(owner, accounts[0], "Contract owner is not set correctly");
                // Verify cap of each stage is set correctly
                var capPreSale = contractVars[3].valueOf();
                assert.equal(capPreSale, maxSupply.mul(0.35), "Pre-sale cap is not set correctly");
                var capStage1 = contractVars[4].valueOf();
                assert.equal(capStage1, maxSupply.mul(0.50), "Stage-1 cap is not set correctly");
                var capStage2 = contractVars[5].valueOf();
                assert.equal(capStage2, maxSupply.mul(0.65), "Stage-2 cap is not set correctly");
                var capStage3 = contractVars[6].valueOf();
                assert.equal(capStage3, maxSupply.mul(0.75), "Stage-3 cap is not set correctly");
                // Verify weiRaised and tokenSold is 0 before we do anything with it
                var weiRaised = contractVars[7].valueOf();
                assert.equal(weiRaised, 0, "Initial weiRaised is not 0");
                var tokenSold = contractVars[8].valueOf();
                assert.equal(tokenSold, 0, "Initial tokenSold is not 0");
                // Verify that ICO specification is not confirmed by default
                var icoSpecConfirmed = contractVars[9].valueOf();
                assert(!icoSpecConfirmed, "ICO specification is confirmed by default");
                // Verify the startTimeStage1 is set as a large value by default
                var startTimeStage1 = contractVars[10].valueOf();
                assert.equal(startTimeStage1, 4102444799, 'Start time of stage 1 is not set as expected'); 
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Token contract is deployed with lockup set to true', function(done) {
            instance.token.call().then(function(tokenAddress) {
                tokenInstance = CerttifyToken.at(tokenAddress);
                return tokenInstance.lockup.call();
            }).then(function(lockup) {
                assert(lockup, 'Token contract is not locked up upon creation');
                done();
            }).catch(function(err) {
                done(err);
            });;
        });
    
        it('Bounty contract deployed successfully and funded with 3% of total created token', function(done) {
            var contractVars = null;
            const maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            // Get Bounty contract address
            instance.bounty.call().then(function(_bountyAddress) {
                var bountyInstance = Bounty.at(_bountyAddress);
                assert.isNotNull(bountyInstance, null, "Crowdsale contract did not deploy the Bounty contact");
                // Get balances of the main ICO contract and bounty contract
                promises = [];
                promises.push(getTokenBalance(instance, instance.address));
                promises.push(getTokenBalance(instance, bountyInstance.address));
                return Promise.all(promises);
            }).then(function(balances) {
                var icoContractBalance = balances[0];
                assert(icoContractBalance.cmp(maxSupply.mul(0.97)) == 0, 'Crowdsale contract did not retain 97% of created token');
                var bountyBalance = balances[1];
                assert(bountyBalance.cmp(maxSupply.mul(0.03)) == 0, 'Bounty contract did not reserve 3% of total created token');
                done();
            }).catch(function(err) {
                done(err);
            });;
        });

        it('Cannot deploy contract with 0x0 address', function(done) {
            const emptyAddress = "0x0000000000000000000000000000000000000000";
            assertRevert(Crowdsale.new(emptyAddress, _owner, _bountyAdmin, {
                from: accounts[1]
            })).then(function() {
                return assertRevert(Crowdsale.new(_wallet, emptyAddress, _bountyAdmin, {
                    from: accounts[1]
                }));
            }).then(function() {
                return assertRevert(Crowdsale.new(_wallet, _owner, emptyAddress, {
                    from: accounts[1]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Handling a valid pre-sale call', function(done) {
            // Legit pre-sale function call, buy 10000 Certtify token in pre-sale to accounts[1], called by contractOwner
            instance.buyTokensPreSale(accounts[1], web3.toBigNumber('1e+22'), {
                from: accounts[0]
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
            var maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            var maxPreSale = maxSupply.mul(0.35); // 35% of max supply
            // Buy 50% of pre-sale max cap in 2 transactions, both should be valid
            var promises = [];
            promises.push(instance.buyTokensPreSale(accounts[1], maxPreSale.mul(0.5), {
                from: accounts[0]
            }));
            promises.push(instance.buyTokensPreSale(accounts[2], maxPreSale.mul(0.5), {
                from: accounts[0]
            }));
            Promise.all(promises).then(function() {
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
                return assertRevert(instance.buyTokensPreSale(accounts[3], 1, {
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Only contract owner can execute pre-sale function', function(done) {
            assertRevert(instance.buyTokensPreSale(accounts[1], 1, {
                from: accounts[2]
            })).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Cannot pre-sale to address(0)', function(done) {
            assertRevert(instance.buyTokensPreSale('0x0000000000000000000000000000000000000000', 1, {
                from: accounts[0]
            })).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Cannot pre-sale 0 token', function(done) {
            assertRevert(instance.buyTokensPreSale(accounts[1], web3.toBigNumber('0'), {
                from: accounts[0]
            })).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Cannot pre-sale negative amount of tokens', function(done) {
            assertRevert(instance.buyTokensPreSale(accounts[1], web3.toBigNumber('-1e+18'), {
                from: accounts[0]
            })).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Can set ICO specification', function(done) {
            const maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                from: accounts[0]
            }).then(function() {
                // Get all public contract variables
                var promises = [];
                promises.push(instance.token.call());
                promises.push(instance.startTimeStage1.call());
                promises.push(instance.startTimeStage2.call());
                promises.push(instance.startTimeStage3.call());
                promises.push(instance.endTime.call());
                promises.push(instance.wallet.call());
                promises.push(instance.owner.call());
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
                promises.push(instance.icoSpecConfirmed.call());
                promises.push(instance.startTimeStage1.call());
                return Promise.all(promises);
            }).then(function(_contractVars) {
                // Verify all contract variable one-by-one
                contractVars = _contractVars;
                // Verify the CerttifyToken is deployed
                var tokenAddress = contractVars[0];
                var tokenInstance = CerttifyToken.at(tokenAddress);
                assert.isNotNull(tokenInstance, null, "Crowdsale contract did not deploy the CerttifyToken contact");
                // Verrify that timestamps are set correctly
                var startStage1 = contractVars[1].valueOf();
                assert.equal(startStage1, _timestampStage1, "Start time of stage 1 ICO is not set correctly");
                var startStage2 = contractVars[2].valueOf();
                assert.equal(startStage2, _timestampStage2, "Start time of stage 2 ICO is not set correctly");
                var startStage3 = contractVars[3].valueOf();
                assert.equal(startStage3, _timestampStage3, "Start time of stage 3 ICO is not set correctly");
                var endICO = contractVars[4].valueOf();
                assert.equal(endICO, _timestampEndTime, "End time of ICO is not set correctly");
                // Verify ETH collection address and owner is set
                var ethWallet = contractVars[5];
                assert.equal(ethWallet, _wallet, "ETH collection wallet is not set correctly");
                var owner = contractVars[6];
                assert.equal(owner, accounts[0], "Contract owner is not set correctly");
                // Verify wei rate is converted into wei rate correctly
                var rateStage1 = contractVars[7].valueOf();
                assert.equal(rateStage1, web3._extend.utils.toWei(_weiCostOfTokenStage1, 'wei'), "Rate of stage 1 ICO is not set correctly");
                var rateStage2 = contractVars[8].valueOf();
                assert.equal(rateStage2, web3._extend.utils.toWei(_weiCostOfTokenStage2, 'wei'), "Rate of stage 2 ICO is not set correctly");
                var rateStage3 = contractVars[9].valueOf();
                assert.equal(rateStage3, web3._extend.utils.toWei(_weiCostOfTokenStage3, 'wei'), "Rate of stage 3 ICO is not set correctly");
                // Verify cap of each stage is set correctly
                var capPreSale = contractVars[10].valueOf();
                assert.equal(capPreSale, maxSupply.mul(0.35), "Pre-sale cap is not set correctly");
                var capStage1 = contractVars[11].valueOf();
                assert.equal(capStage1, maxSupply.mul(0.5), "Stage-1 cap is not set correctly");
                var capStage2 = contractVars[12].valueOf();
                assert.equal(capStage2, maxSupply.mul(0.65), "Stage-2 cap is not set correctly");
                var capStage3 = contractVars[13].valueOf();
                assert.equal(capStage3, maxSupply.mul(0.75), "Stage-3 cap is not set correctly");
                // Verify weiRaised and tokenSold is 0 before we do anything with it
                var weiRaised = contractVars[14].valueOf();
                assert.equal(weiRaised, 0, "Initial weiRaised is not 0");
                var tokenSold = contractVars[15].valueOf();
                assert.equal(tokenSold, 0, "Initial tokenSold is not 0");
                var founderTokenUnlockPhase1 = contractVars[16].valueOf();
                assert.equal(founderTokenUnlockPhase1.valueOf(), _founderTokenUnlockPhase1, "Phase 1 unlock time of founders' token is not set correctly");
                var founderTokenUnlockPhase2 = contractVars[17].valueOf();
                assert.equal(founderTokenUnlockPhase2.valueOf(), _founderTokenUnlockPhase2, "Phase 2 unlock time of founders' token is not set correctly");
                var founderTokenUnlockPhase3 = contractVars[18].valueOf();
                assert.equal(founderTokenUnlockPhase3.valueOf(), _founderTokenUnlockPhase3, "Phase 3 unlock time of founders' token is not set correctly");
                var founderTokenUnlockPhase4 = contractVars[19].valueOf();
                assert.equal(founderTokenUnlockPhase4.valueOf(), _founderTokenUnlockPhase4, "Phase 4 unlock time of founders' token is not set correctly");
                var founderTokenWithdrawnPhase1 = contractVars[20].valueOf();
                assert(!founderTokenWithdrawnPhase1, "Founders' token withdrawn status in phase 1 is not false by default");
                var founderTokenWithdrawnPhase2 = contractVars[21].valueOf();
                assert(!founderTokenWithdrawnPhase2, "Founders' token withdrawn status in phase 2 is not false by default");
                var founderTokenWithdrawnPhase3 = contractVars[22].valueOf();
                assert(!founderTokenWithdrawnPhase3, "Founders' token withdrawn status in phase 3 is not false by default");
                var founderTokenWithdrawnPhase4 = contractVars[23].valueOf();
                assert(!founderTokenWithdrawnPhase4, "Founders' token withdrawn status in phase 4 is not false by default");
                var founderWithdrawablePhase1 = contractVars[24].valueOf();
                assert.equal(founderWithdrawablePhase1.valueOf(), 0, "Amount of token withdrawable by founders in phase 1 is not 0 by default");
                var founderWithdrawablePhase2 = contractVars[25].valueOf();
                assert.equal(founderWithdrawablePhase2.valueOf(), 0, "Amount of token withdrawable by founders in phase 2 is not 0 by default");
                var founderWithdrawablePhase3 = contractVars[26].valueOf();
                assert.equal(founderWithdrawablePhase3.valueOf(), 0, "Amount of token withdrawable by founders in phase 3 is not 0 by default");
                var founderWithdrawablePhase4 = contractVars[27].valueOf();
                assert.equal(founderWithdrawablePhase4.valueOf(), 0, "Amount of token withdrawable by founders in phase 4 is not 0 by default");
                var icoSpecConfirmed = contractVars[28].valueOf();
                assert(!icoSpecConfirmed, "ICO specification is confirmed by default");
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Only owner can set ICO specification', function(done) {
            assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                from: accounts[1]
            })).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Cannot set unreasonable ICO specification', function(done) {
            assertRevert(instance.setICOSpec(0, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                from: accounts[0]
            })).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, 0, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, 0, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, 0, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, 0, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, 0, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, 0, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, 0, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, 0, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, 0, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, 0, {
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Can confirm ICO specification', function(done) {
            instance.confirmICOSpec({
                from: accounts[0]
            }).then(function() {
                return instance.icoSpecConfirmed.call();
            }).then(function(specConfirmed) {
                assert(specConfirmed, 'ICO spec cannot be confirmed');
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Only owner can confirm ICO sppecification', function(done) {
            assertRevert(instance.confirmICOSpec({
                from: accounts[1]
            })).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Cannot set ICO specification after confirmation', function(done) {
            instance.confirmICOSpec({
                from: accounts[0]
            }).then(function() {
                return assertRevert(instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });

        it('Cannot buy token in public sale before confirmation', function(done) {
            // Set phrase 1 to have started without confirming the specification
            instance.setICOSpec(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                from: accounts[0]
            }).then(function() {
                return new Promise(function(resolve, reject) {
                    web3.eth.sendTransaction({
                        from: accounts[0],
                        to: instance.address,
                        value: web3._extend.utils.toWei(1, 'ether'),
                        gas: 500000
                    }, function(err) {
                        if (err) {
                            resolve();
                        }
                        else {
                            reject('ICO can proceed before confirmation');
                        }
                    });
                });
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        })

    });

    describe('After ICO specification confirmation', function() {

        var instance = null;

        /**
         * Confirm ICO Specification
         * 
         * @param {number} _timestampStage1 Timestamp in seconds since Unix epoch for stage 1 ICO to begin
         * @param {number} _timestampStage2 Timestamp in seconds since Unix epoch for stage 2 ICO to begin
         * @param {number} _timestampStage3 Timestamp in seconds since Unix epoch for stage 3 ICO to begin
         * @param {number} _timestampEndTime Timestamp in seconds since Unix epoch for ending the ICO
         * @param {number} _weiCostOfTokenStage1 Cost of each Certtify token, measured in wei, in stage 1 ICO
         * @param {number} _weiCostOfTokenStage2 Cost of each Certtify token, measured in wei, in stage 2 ICO
         * @param {number} _weiCostOfTokenStage3 Cost of each Certtify token, measured in wei, in stage 3 ICO
         * @param {number} _founderTokenUnlockPhase1 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 1
         * @param {number} _founderTokenUnlockPhase2 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 2
         * @param {number} _founderTokenUnlockPhase3 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 3
         * @param {number} _founderTokenUnlockPhase4 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 4
         */
        var confirmSpec = function(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4) {
            return new Promise(function(resolve, reject) {
                instance.setICOSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
                    from: accounts[0]
                }).then(function() {
                    return instance.confirmICOSpec({
                        from: accounts[0]
                    });
                }).then(function() {
                    resolve();
                }).catch(function(err) {
                    reject(err);
                });
            })
        }

        /**
         * Function for purchasing and then confirming the sale is executed successfully
         * The following are confirmed,
         *      1. Transaction is executed with no error
         *      2. Investor are rewarded with the expected amount of token (etherSent * rate * 1e+18)
         *      3. Fund is sent to address 'wallet'
         *      4. TokenPurchase event is logging the event correctly
         * Return a Promise which will resolve if all test are passed, or throw if any error occured with the reason stated
         * 
         * @param {*} instance Crowdsale contract instance
         * @param {string} address Address that sends the Ether
         * @param {string} wallet Wallet that receive the bought token
         * @param {number} etherSent Total number of ether to send
         * @param {number} rate Expected ether-token conversion rate
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
         * 
         * @param {number} tokenRequired Number of token to bought
         * @param {number} rateInWei Ether-token conversion rate in WEI
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
         * 
         * @param {*} instance Crowdsale contract instance
         * @param {*} tokenInstance Token contract instance
         * @param {*} deployerAddress Address of the Crowdsale contract deployer
         * @param {*} deployerBal Expected balance of the contract deployer after withdrawl
         * @param {*} contractBal Expected balance of the contract after withdrawl
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

        beforeEach(function(done) {
            Crowdsale.new(_wallet, _owner, _bountyAdmin, {
                from: accounts[1]
            }).then(function(_instance) {
                instance = _instance;
                done();
            });
        });

        it('Handling a valid pre-sale call', function(done) {
            confirmSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
            var maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            var maxPreSale = maxSupply.mul(0.35); // 35% of max supply
            confirmSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
                return assertRevert(instance.buyTokensPreSale(accounts[3], 1, {
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Only contract owner can execute pre-sale function', function(done) {
            confirmSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                return assertRevert(instance.buyTokensPreSale(accounts[1], 1, {
                    from: accounts[2]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Cannot pre-sale to address(0)', function(done) {
            confirmSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                return assertRevert(instance.buyTokensPreSale('0x0000000000000000000000000000000000000000', 1, {
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Cannot pre-sale negative amount of tokens', function(done) {
            confirmSpec(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                return assertRevert(instance.buyTokensPreSale(accounts[1], web3.toBigNumber('-1e+18'), {
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Cannot pre-sale after stage-1 is launched', function(done) {
            // Deploy contract but immediately begin stage 1
            confirmSpec(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                return assertRevert(instance.buyTokensPreSale(accounts[1], 1, {
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Handle a valid public buy token request in stage 1 ICO', function(done) {
            // Deploy contract but immediately begin stage 1
            confirmSpec(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
            confirmSpec(getTimestamp(0), getTimestamp(0), _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                var contractAddress = instance.address;
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
            var maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            // Deploy contract but immediately begin stage 1
            confirmSpec(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                const STAGE_1_PURCHASE = web3.toBigNumber(0.25);
                const STAGE_2_PURCHASE = web3.toBigNumber(0.06);
                const STAGE_3_PURCHASE = web3.toBigNumber(0.0175);
                /**
                 * Stage 1 ICO Purchases Test
                 * 
                 * Max cap of stage 1 ICO is 50% of MAX_SUPPLY (with 0% pre-sale)
                 * Here, we make 2 purchase, each with 10% of MAX_SUPPLY, and should reach the cap of stage 1
                 */
                purchaseConfirmSale(instance, accounts[1], _wallet, calEther(maxSupply.mul(STAGE_1_PURCHASE), _weiCostOfTokenStage1), _weiCostOfTokenStage1).then(function() {
                    return purchaseConfirmSale(instance, accounts[2], _wallet, calEther(maxSupply.mul(STAGE_1_PURCHASE), _weiCostOfTokenStage1), _weiCostOfTokenStage1);
                })
                /**
                 * Stage 2 ICO Purchase Test
                 * 
                 * Stage 1 ICO should be closed at this point since its cap is reached
                 * Max cap of stage 2 is 15% of MAX_SUPPLY
                 * Here, we make 3 purchases, each with 6% of MAX_SUPPLY, and should over-exceed the cap of stage 2
                 * [ 0% --> 6% --> 12% --> 18% (Over-bought stage 2) ]
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
                 * Max cap of stage 3 is originally 10% of MAX_SUPPLY
                 * However, since the last stage is over-bought for 18% - 15% = 3%
                 * Actual cap for stage 3 should be only 10% - 3% = 7% of MAX_SUPPLY
                 * 
                 * Here we make 4 purchases, each with 1.75% of MAX_SUPPLY, which should just met the cap
                 * All 4 transactions should go through with rate of stage 3 ICO
                 * One more purcahses with 1.75% + 1 token will be made before the final purchase to test if it is possible to buy over the set MAX_ALLOWED_TOTAL cap
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
                    // Attempt over-buying over the cap with ether enough to buy 5.75% MAX_SUPPLY + 1 wei
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
                 *      Phase 2, 3 & 4: 4% of MAX_SUPPLY
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
                    assert(founderWithdrawablePhase1.cmp(maxSupply.mul(0.10)) == 0, 'Amount of token withdrawable by founders in phase 1 is not identical to 10% of all available token');
                    // Assert founderWithdrawablePhase2
                    var founderWithdrawablePhase2 = founderWithdrawable[1];
                    assert(founderWithdrawablePhase2.cmp(maxSupply.mul(0.04)) == 0, 'Amount of token withdrawable by founders in phase 2 is not identical to 4% of all available token');
                    // Assert founderWithdrawablePhase3
                    var founderWithdrawablePhase3 = founderWithdrawable[2];
                    assert(founderWithdrawablePhase3.cmp(maxSupply.mul(0.04)) == 0, 'Amount of token withdrawable by founders in phase 3 is not identical to 4% of all available token');
                    // Assert founderWithdrawablePhase4
                    var founderWithdrawablePhase4 = founderWithdrawable[3];
                    assert(founderWithdrawablePhase4.cmp(maxSupply.mul(0.04)) == 0, 'Amount of token withdrawable by founders in phase 4 is not identical to 4% of all available token');
                    done();
                }).catch(function(err) {
                    // Some error occured
                    done(err);
                });
            });
        });
    
        it('Cannot request ICO to address(0)', function(done) {
            confirmSpec(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                return assertRevert(instance.buyTokens('0x0000000000000000000000000000000000000000', {
                    from: accounts[1],
                    gas: 500000,
                    value: web3._extend.utils.toWei(1, 'ether')
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done('ICO request to address(0) does not result in error');
            });
        });
    
        it('Cannot buy token with 0 wei sent', function(done) {
            confirmSpec(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
            var oriBalance = null;
            confirmSpec(getTimestamp(0), _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
            var tokenInstance = null;
            var founderWithdrawable = null;
            var maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            // Buy 36% of token in the whole ICO
            var tokenBought = maxSupply.mul(web3.toBigNumber(0.36));
            // Total token distributed = 36% (Bought) + 3% (Bounty) = 39%
            // Founder should be able to withdraw 39% * 22/78 = 11% of token
            var withdrawableTotal = tokenBought.add(maxSupply.mul(web3.toBigNumber(0.03))).mul(22).div(78);
            var withdrawablePhase1 = withdrawableTotal.mul(10).div(22);
            var withdrawablePhase2 = withdrawableTotal.mul(4).div(22);
            var withdrawablePhase3 = withdrawableTotal.mul(4).div(22);
            var withdrawablePhase4 = withdrawableTotal.mul(4).div(22);
            // Maximum supply left should be 50% of maxSupply [36% (Bought) + 3% (Bounty) + 11% (Locked)]
            var maxSupplyLeft = tokenBought.add(maxSupply.mul(web3.toBigNumber(0.03))).add(withdrawableTotal);
            // Deploy the contract, immediately start stage 3 ICO
            // Gives ourself 12 seconds to buy the token before testing the function
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0.2), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(tokenBought, _weiCostOfTokenStage3), _weiCostOfTokenStage3);
            }).then(function() {
                // Wait for 15 seconds for ICO to end
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve();
                    }, 15 * 1000);
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
                // Assert 4% of total supply is withdrawable
                // Phase 1: 4% * 52% = 2.08%; Phase 2, 3 & 4: 4% * 16% = 0.64%
                assert(founderWithdrawable[0].cmp(withdrawablePhase1) == 0, 'Token withdrawable to founders in phase 1 does not equate to 10% of total available supply when maximum cap is not reached');
                assert(founderWithdrawable[1].cmp(withdrawablePhase2) == 0, 'Token withdrawable to founders in phase 2 does not equate to 4% of total available supply when maximum cap is not reached');
                assert(founderWithdrawable[2].cmp(withdrawablePhase2) == 0, 'Token withdrawable to founders in phase 3 does not equate to 4% of total available supply when maximum cap is not reached');
                assert(founderWithdrawable[3].cmp(withdrawablePhase2) == 0, 'Token withdrawable to founders in phase 4 does not equate to 4% of total available supply when maximum cap is not reached');
                var founderWithdrawableTotal = founderWithdrawable[0].add(founderWithdrawable[1]).add(founderWithdrawable[2]).add(founderWithdrawable[3]);
                assert(founderWithdrawableTotal.cmp(withdrawableTotal) == 0, 'Total token withdrawable to founders does not equate to 22% of total available supply when maximum cap is not reached');
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
                assert(balanceOfContract.cmp(withdrawableTotal) == 0, 'Contract did not hold token equivalent to founderWithdrawable after the postICO call');
                // Test if postICO can be called after a successful call
                return assertRevert(instance.postICO({
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('postICO can only be called by contract owner', function(done) {
            // Deploy contract in end-ico stage
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                // Get hasEnded
                return instance.hasEnded.call();
            }).then(function(hasEnded) {
                // Assert ICO has ended
                assert(hasEnded, 'ICO did not end after end timestamp');
                // Call postICO from another address
                return assertRevert(instance.postICO({
                    from: accounts[1]
                }));
            }).then(function() {
                done();
            }).catch(function() {
                done('postICO can be called by people other than contract owner');
            });
        });
    
        it('postICO cannot be called before ICO is over', function(done) {
            // Deploy contract in end-ico stage
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                // Get hasEnded
                return instance.hasEnded.call();
            }).then(function(hasEnded) {
                // Assert ICO has ended
                assert(!hasEnded, 'ICO end before end timestamp');
                // Call postICO from another address
                return assertRevert(instance.postICO({
                    from: accounts[0]
                }));
            }).then(function() {
                done();
            }).catch(function() {
                done('postICO can be called before ICO is over');
            });
        });
    
        it('postICO unlock the token lockup', function(done) {
            // Deploy contract in end-ico stage
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
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
            var tokenInstance = null;
            var founderWithdrawable = null;
            var maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            // Buy 36% of token in the whole ICO
            var tokenBought = maxSupply.mul(web3.toBigNumber(0.36));
            // Founder should be able to withdraw [36% (Sale) + 3% [Bounty]) * 22/78 = 11% of token, since they will own 22% of the 50% supply available
            var withdrawable = tokenBought.add(maxSupply.mul(web3.toBigNumber(0.03))).mul(22).div(78);
            // In phase 1, 10/22 of withdrawable
            var withdrawablePhase1 = withdrawable.mul(10).div(22);
            // In phase 2, 16% of withdrawable
            var withdrawablePhase2 = withdrawable.mul(4).div(22);
            // In phase 3, 16% of withdrawable
            var withdrawablePhase3 = withdrawable.mul(4).div(22);
            // In phase 4, 16% of withdrawable
            var withdrawablePhase4 = withdrawable.mul(4).div(22);
            // Deploy the contract, immediately start stage 3 ICO
            // Gives ourself 6 seconds to buy the token before testing the function, and allow founder to withdraw unlocked token from all phase after 12 seconds
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0.1), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, getTimestamp(0.2), getTimestamp(0.2), getTimestamp(0.2), getTimestamp(0.2)).then(function() {
                return purchaseConfirmSale(instance, accounts[1], _wallet, calEther(tokenBought, _weiCostOfTokenStage3), _weiCostOfTokenStage3);
            }).then(function() {
                // Wait for 15 seconds for ICO to end
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve();
                    }, 15 * 1000);
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
                 * 2.08% (4% * 0.52) of token should be withdrawn by founders so far
                 */
                var deployerBalance = withdrawablePhase1;
                var contractBalance = withdrawable.sub(deployerBalance);
                return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
            }).then(function() {
                /**
                 * Withdraw phase 2 unlocked token
                 * 2.72% (4% * 0.68) of token should be withdrawn by founders so far
                 */
                var deployerBalance = withdrawablePhase1.add(withdrawablePhase2);
                var contractBalance = withdrawable.sub(deployerBalance);
                return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
            }).then(function() {
                /**
                 * Withdraw phase 3 unlocked token
                 * 3.36% (4% * 0.84) of token should be withdrawn by founders so far
                 */
                var deployerBalance = withdrawablePhase1.add(withdrawablePhase2).add(withdrawablePhase3);
                var contractBalance = withdrawable.sub(deployerBalance);
                return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
            }).then(function() {
                /**
                 * Withdraw phase 4 unlocked token
                 * 4% of token should be withdrawn by founders
                 */
                var deployerBalance = withdrawable;
                var contractBalance = web3.toBigNumber(0);
                return confirmWithdraw(instance, tokenInstance, accounts[0], deployerBalance, contractBalance);
            }).then(function() {
                // Call founderWithdraw() after all tokens withdrawn, should fail
                return assertRevert(instance.founderWithdraw());
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('Cannot founderWithdraw a phase before the unlock time', function(done) {
            var tokenInstance = null;
            var maxSupply = web3.toBigNumber('55e25'); // 5.5e8 * 1e18
            // Buy 36% of token in the whole ICO
            var tokenBought = maxSupply.mul(web3.toBigNumber(0.36));
            // Founder should be able to withdraw [36% (Sale) + 3% [Bounty]) * 22/78 = 11% of token, since they will own 22% of the 50% supply available
            var withdrawable = tokenBought.add(maxSupply.mul(web3.toBigNumber(0.03))).mul(22).div(78);
            // In phase 1, 10/22 of withdrawable
            var withdrawablePhase1 = withdrawable.mul(10).div(22);
            // In phase 2, 16% of withdrawable
            var withdrawablePhase2 = withdrawable.mul(4).div(22);
            // In phase 3, 16% of withdrawable
            var withdrawablePhase3 = withdrawable.mul(4).div(22);
            // In phase 4, 16% of withdrawable
            var withdrawablePhase4 = withdrawable.mul(4).div(22);
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
            confirmSpec(now, now, now, icoEnd, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, phase1, phase2, phase3, phase4).then(function() {
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
                return assertRevert(instance.founderWithdraw());
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
                return assertRevert(instance.founderWithdraw());
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
                return assertRevert(instance.founderWithdraw());
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
                return assertRevert(instance.founderWithdraw());
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
                return assertRevert(instance.founderWithdraw());
            }).then(function() {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    
        it('founderWithdraw can only be called by contract owner', function(done) {
            // Deploy contract with founders' token unlocked already
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0)).then(function() {
                return instance.postICO();
            }).then(function() {
                return assertRevert(instance.founderWithdraw({ from: accounts[1] }));
            }).then(function() {
                done();
            }).catch(function(err) {
                done('No error is thrown when founderWithdraw() is not called by owner');
            });
        });
    
        it('founderWithdraw cannot be called before founder token are unlocked', function(done) {
            // Deploy contract with founders' token not yet unlocked
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4).then(function() {
                return instance.postICO();
            }).then(function() {
                return assertRevert(instance.founderWithdraw());
            }).then(function() {
                done();
            }).catch(function(err) {
                done('No error is thrown when founderWithdraw() is called before unlock time');
            });
        });
    
        it('founderWithdraw cannot be called before postICO is called', function(done) {
            // Deploy contract with founders' token unlocked already
            confirmSpec(getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0), _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, getTimestamp(0), getTimestamp(0), getTimestamp(0), getTimestamp(0)).then(function() {
                return assertRevert(instance.founderWithdraw());
            }).then(function() {
                done();
            }).catch(function(err) {
                done('No error is thrown when founderWithdraw() is called before postICO is called');
            });
        })

    });

});