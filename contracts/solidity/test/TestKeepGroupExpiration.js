import { duration } from './helpers/increaseTime';
import exceptThrow from './helpers/expectThrow';
import {bls} from './helpers/data';
const KeepToken = artifacts.require('./KeepToken.sol');
const StakingProxy = artifacts.require('./StakingProxy.sol');
const TokenStaking = artifacts.require('./TokenStaking.sol');
const KeepRandomBeaconProxy = artifacts.require('./KeepRandomBeacon.sol');
const KeepRandomBeaconImplV1 = artifacts.require('./KeepRandomBeaconImplV1.sol');
const KeepGroupProxy = artifacts.require('./KeepGroup.sol');
const KeepGroupImplV1 = artifacts.require('./KeepGroupImplV1.sol');


function generateTickets(randomBeaconValue, stakerValue, stakerWeight) {
  let tickets = [];
  for (let i = 1; i <= stakerWeight; i++) {
    let ticketValue = web3.utils.toBN(
      web3.utils.soliditySha3({t: 'uint', v: randomBeaconValue}, {t: 'uint', v: stakerValue}, {t: 'uint', v: i})
    );
    let ticket = {
      value: ticketValue,
      virtualStakerIndex: i
    }
    tickets.push(ticket);
  }
  return tickets
}

function mineBlocks(blocks) {
  for (let i = 0; i <= blocks; i++) {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_mine",
      id: 12345
    }, function(err, _) {
      if (err) console.log("Error mining a block.")
    });
  }
}

contract('TestKeepGroupExpiration', function(accounts) {

  let token, stakingProxy, minimumStake, groupThreshold, groupSize,
    timeoutInitial, timeoutSubmission, timeoutChallenge,
    groupExpirationTimeout, activeGroupsThreshold,
    keepRandomBeaconImplV1, keepRandomBeaconProxy,
    keepGroupImplV1, keepGroupProxy, keepGroupImplViaProxy, testGroupsNumber

  beforeEach(async () => {
    token = await KeepToken.new();
    
    // Initialize staking contract under proxy
    stakingProxy = await StakingProxy.new();
    
    keepRandomBeaconImplV1 = await KeepRandomBeaconImplV1.new();
    keepRandomBeaconProxy = await KeepRandomBeaconProxy.new(keepRandomBeaconImplV1.address);
    
    // Initialize Keep Group contract
    minimumStake = 200000;
    groupThreshold = 15;
    groupSize = 20;
    timeoutInitial = 20;
    timeoutSubmission = 50;
    timeoutChallenge = 60;
    groupExpirationTimeout = 1;
    activeGroupsThreshold = 1;

    keepGroupImplV1 = await KeepGroupImplV1.new();
    keepGroupProxy = await KeepGroupProxy.new(keepGroupImplV1.address);
    keepGroupImplViaProxy = await KeepGroupImplV1.at(keepGroupProxy.address);
    await keepGroupImplViaProxy.initialize(
      stakingProxy.address, keepRandomBeaconProxy.address, minimumStake, groupThreshold, groupSize, timeoutInitial, timeoutSubmission, timeoutChallenge, groupExpirationTimeout, activeGroupsThreshold
    );

    testGroupsNumber = 7;

    for (var i = 1; i <= testGroupsNumber; i++)
      await keepGroupImplV1.submitGroupPublicKey([i], i);
  });

  it("should be able to check if groups were added", async function() {
    let numberOfGroups = await keepGroupImplV1.numberOfGroups();
    assert.equal(Number(numberOfGroups), testGroupsNumber, "Number of groups not equals to number of test groups");
  });

  it("should be able to check if one group expires", async function() {
    let before = await keepGroupImplV1.numberOfGroups();
    assert.equal(Number(before), testGroupsNumber, "Number of groups should be equal to the number of test groups"); 
    mineBlocks(groupExpirationTimeout);
    let tx = await keepGroupImplV1.selectGroup("1");
    //console.log("Gas used for keepGroupImplV1.selectGroup(1) = ", tx.receipt.gasUsed);
    let after = await keepGroupImplV1.numberOfGroups();
    assert.notEqual(Number(after), testGroupsNumber, "Number of groups after `selectGroup()` should not be equal to the number of test groups");
  });

  it("should be able to check if more than one group expires", async function() {
    mineBlocks(groupExpirationTimeout);
    await keepGroupImplV1.selectGroup("1");
    mineBlocks(groupExpirationTimeout);
    await keepGroupImplV1.selectGroup("1");
    mineBlocks(groupExpirationTimeout);
    await keepGroupImplV1.selectGroup("1");
    mineBlocks(groupExpirationTimeout);
    await keepGroupImplV1.selectGroup("1");
  
    let after = await keepGroupImplV1.numberOfGroups();
    assert.isBelow(Number(after), testGroupsNumber - 1, "Number of groups should be at least 2 below the test group numbers");
  });

  it("nuber of groups should not be able to go below the active groups threshold", async function() {
    for (var i = 1; i <= 10; i++)
      await keepGroupImplV1.submitGroupPublicKey([i], i);

    for (var i = 1; i <= 20; i++) {
      mineBlocks(groupExpirationTimeout);
      let tx = await keepGroupImplV1.selectGroup(i);
      //console.log("Gas used for keepGroupImplV1.selectGroup(i) = ", tx.receipt.gasUsed);
    }

    let after = await keepGroupImplV1.numberOfGroups();
    assert.isAtLeast(Number(after), activeGroupsThreshold, "Number of groups should be equal to active groups threshold");
  });
});