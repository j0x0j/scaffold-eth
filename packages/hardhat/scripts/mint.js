/* eslint no-use-before-define: "warn" */
const assert = require("assert");
const { ethers } = require("hardhat");
const ipfsAPI = require("ipfs-http-client");

const ipfs = ipfsAPI.create({
  host: "ipfs.infura.io",
  port: "5001",
  protocol: "https",
});

const delayMS = 5000; // sometimes xDAI needs a 6000ms break lol 😅

const sleep = function (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const main = async () => {
  // ADDRESS TO MINT TO, CHANGE TO YOUR ACCOUNT:
  const toAddress = "0x0";

  assert(toAddress, new Error("Please provide an address to mint tokens to"));

  console.log("\n\n 🎫 Minting to " + toAddress + "...\n");

  const { deployer } = await ethers.getNamedSigners();
  const weatherDerivative = await ethers.getContract(
    "WeatherDerivative",
    deployer
  );

  const baseUriPath = "https://ipfs.io/ipfs/";

  const sanjuan = {
    description: "WDT for San Juan, PR",
    external_url: "https://twitter.com/PRHBDS", // <-- this can link to a page for the specific file too
    image: "https://pbs.twimg.com/media/FAFuTq3XMAE6QK0?format=jpg&name=small",
    name: "San Juan",
    attributes: [
      {
        trait_type: "Location",
        value: "pr-01",
      },
      {
        trait_type: "Basin",
        value: "na",
      },
      {
        trait_type: "LossLimit",
        value: 0.25,
      },
    ],
  };

  console.log("Uploading sanjuan...");
  const uploadedsanjuan = await ipfs.add(JSON.stringify(sanjuan));

  console.log("Minting sanjuan with IPFS hash (" + uploadedsanjuan.path + ")");
  await weatherDerivative.mintItem(
    toAddress,
    baseUriPath + uploadedsanjuan.path,
    [5, 10, 15, 25, 100],
    { value: ethers.utils.parseEther("0.25"), gasLimit: 1200000 }
  );

  await sleep(delayMS);

  const santodomingo = {
    description: "WDT for Santo Domingo, DO",
    external_url: "https://twitter.com/PRHBDS", // <-- this can link to a page for the specific file too
    image:
      "https://cdn.travelpulse.com/images/99999999-9999-9999-9999-999999999999/a3ae0595-fbc6-e611-9aa9-0050568e420d/630x355.jpg",
    name: "Santo Domingo",
    attributes: [
      {
        trait_type: "Location",
        value: "do-01",
      },
      {
        trait_type: "Basin",
        value: "na",
      },
      {
        trait_type: "LossLimit",
        value: 0.25,
      },
    ],
  };

  console.log("Uploading santodomingo...");
  const uploadedsantodomingo = await ipfs.add(JSON.stringify(santodomingo));

  console.log(
    "Minting santodomingo with IPFS hash (" + uploadedsantodomingo.path + ")"
  );
  await weatherDerivative.mintItem(
    toAddress,
    baseUriPath + uploadedsantodomingo.path,
    [5, 10, 15, 25, 100],
    { value: ethers.utils.parseEther("0.25"), gasLimit: 1200000 }
  );

  await sleep(delayMS);

  const miami = {
    description: "WDT for Miami, FL",
    external_url: "https://en.wikipedia.org/wiki/Miami",
    image:
      "https://therealdeal.com/miami/wp-content/uploads/2014/06/historicpost.gif",
    name: "Miami",
    attributes: [
      {
        trait_type: "Location",
        value: "fl-01",
      },
      {
        trait_type: "Basin",
        value: "na",
      },
      {
        trait_type: "LossLimit",
        value: 0.25,
      },
    ],
  };

  console.log("Uploading miami...");
  const uploadedmiami = await ipfs.add(JSON.stringify(miami));

  console.log("Minting miami with IPFS hash (" + uploadedmiami.path + ")");
  await weatherDerivative.mintItem(
    toAddress,
    baseUriPath + uploadedmiami.path,
    [5, 10, 15, 25, 100],
    { value: ethers.utils.parseEther("0.25"), gasLimit: 1200000 }
  );

  await sleep(delayMS);

  const neworleans = {
    description: "WDT for New Orleans, LO",
    external_url: "https://www.neworleans.com/",
    image:
      "https://cdn.onlyinyourstate.com/wp-content/uploads/2015/06/Pontalba_Buildings_New_Orleans.jpg",
    name: "New Orleans",
    attributes: [
      {
        trait_type: "Location",
        value: "lo-01",
      },
      {
        trait_type: "Basin",
        value: "na",
      },
      {
        trait_type: "LossLimit",
        value: 0.25,
      },
    ],
  };

  console.log("Uploading neworleans...");
  const uploadedneworleans = await ipfs.add(JSON.stringify(neworleans));

  console.log(
    "Minting neworleans with IPFS hash (" + uploadedneworleans.path + ")"
  );
  await weatherDerivative.mintItem(
    toAddress,
    baseUriPath + uploadedneworleans.path,
    [5, 10, 15, 25, 100],
    { value: ethers.utils.parseEther("0.25"), gasLimit: 1200000 }
  );

  await sleep(delayMS);

  const houston = {
    description: "WDT for Houston, TX",
    external_url: "https://en.wikipedia.org/wiki/Houston",
    image:
      "https://2.bp.blogspot.com/-tNQEjfBuZOo/UaaZ9Y81UNI/AAAAAAAAHoE/ALPlNgsrFWk/s1600/Top-of-Niels-Esperson-Building-teleshot-from-the-West-Downtown-Houston-historic-landmark.JPG",
    name: "Houston",
    attributes: [
      {
        trait_type: "Location",
        value: "tx-01",
      },
      {
        trait_type: "Basin",
        value: "na",
      },
      {
        trait_type: "LossLimit",
        value: 0.25,
      },
    ],
  };

  console.log("Uploading houston...");
  const uploadedhouston = await ipfs.add(JSON.stringify(houston));

  console.log("Minting houston with IPFS hash (" + uploadedhouston.path + ")");
  await weatherDerivative.mintItem(
    toAddress,
    baseUriPath + uploadedhouston.path,
    [5, 10, 15, 25, 100],
    { value: ethers.utils.parseEther("0.25"), gasLimit: 1200000 }
  );

  await sleep(delayMS);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
