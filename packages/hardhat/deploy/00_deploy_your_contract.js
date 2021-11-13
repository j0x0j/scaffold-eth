// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const WeatherDerivative = await deploy("WeatherDerivative", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    // args: [ "Hello", ethers.utils.parseEther("1.5") ],
    log: true,
  });

  const wdtAddress = WeatherDerivative.address;
  const claimsURI = "https://public-landing-pages.s3.amazonaws.com";
  // const oracleAddress = ethers.constants.AddressZero;
  const oracleAddress = "0xc57B33452b4F7BB189bB5AfaE9cc4aBa1f7a4FD8";
  // const jobId = "d5270d1c311941d0b08bead21fea7747";

  const ClaimsEngine = await deploy("ClaimsEngine", {
    from: deployer,
    args: [wdtAddress, claimsURI, oracleAddress],
    log: true,
  });

  // Need to send LINK to the ClaimsEngine

  const weatherDerivative = await ethers.getContract(
    "WeatherDerivative",
    deployer
  );

  // Set the claims engine on the token contract
  await weatherDerivative.setClaimsEngine(ClaimsEngine.address);
};
module.exports.tags = ["WeatherDerivative"];
