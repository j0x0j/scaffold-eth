// This contract handles claims and payouts for Weather Derivative Tokens.
pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

// import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "./WeatherDerivative.sol";

contract ClaimsEngine is ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;

    // Chainlink properties
    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    // Timestamp for contract deployment
    uint start;
    // Time the risk escrow will be locked in this contract before allowing withdrawal by owner
    uint constant lockTime = 365 days;

    // The web Claims API URI
    string claimsURI;
    // Weather Derivative Token contract
    WeatherDerivative wdtToken;
    // LINK Token contract
    LinkTokenInterface linkToken;

    // Token ids mapped to oracle requests
    mapping(bytes32 => uint256) requestTokens;
    // Trigger events mapped to oracle requests
    mapping(bytes32 => string) requestEvents;

    // Risk pool balance, the total balance locked as collateral for all tokens
    uint256 riskPoolBalance;

    // Token balances
    mapping(uint256 => uint256) private balances;
    // Term loss limits for tokens, the total collateral set for the token
    mapping(uint256 => uint256) private termLimits;
    // The payout ratios for the weather index thresholds for each token
    mapping(uint256 => uint[]) private payoutOptions;
    // Events that have already paid out claims to a token
    mapping(string => mapping(uint256 => bool)) private claimedEvents;

    constructor(
        address _wdtToken,
        string memory _claimsURI,
        address _oracle
    ) {
        wdtToken = WeatherDerivative(_wdtToken);
        claimsURI = _claimsURI;

        start = block.timestamp;

        // https://www.youtube.com/watch?v=ffU96UhlA0A
        // setChainlinkToken(0x0);
        setPublicChainlinkToken();
        oracle = _oracle;
        // Required Job in Kovan
        jobId = "d5270d1c311941d0b08bead21fea7747";
        // 0.1 LINK
        fee = 0.1 * 10 ** 18;
    }

    /**
     * @dev Gets the total risk pool balance
     */
    function getPoolBalance()
        external
        view
        returns(uint256)
    {
        return riskPoolBalance;
    }

    /**
     * @dev Gets the risk pool balance for a token
     */
    function getTokenBalance(uint256 tokenId)
        external
        view
        returns(uint256)
    {
        return balances[tokenId];
    }

    /**
     * @dev Gets the LINK balance locked in the contract
     */
    function getLinkBalance()
        external
        view
        returns(uint256)
    {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        return link.balanceOf(address(this));
    }
    
    /**
     * @dev Calculation formula to determine payout amount based on weather index and payout options
     * @param index The weather index value provided by the claims web service
     * @param _payoutOptions The payout ratios for the weather index thresholds for the token in the claims process
     * @param limit The total loss limit for the token
     * @return payout The calculated payout amount for the triggered threshold
     */
    function calcPayout(uint256 index, uint[] memory _payoutOptions, uint256 limit)
        private
        pure
        returns(uint256 payout)
    {
        // `index` is already shifted 10**18, should match payout options shift
        // use the index value to determine the offset from the payout options
        // use the value from the payout offset to multiply with `balance`
        // [119, 154] - 0.05
        // [154, 178] - 0.10
        // [178, 209] - 0.15
        // [209, 252] - 0.25
        // [252, 999] - 1.00
        uint payoutOption;
        if (index >= 119_000000000000000000 && index < 154_000000000000000000) { payoutOption = _payoutOptions[0]; }
        if (index >= 154_000000000000000000 && index < 178_000000000000000000) { payoutOption = _payoutOptions[1]; }
        if (index >= 178_000000000000000000 && index < 209_000000000000000000) { payoutOption = _payoutOptions[2]; }
        if (index >= 209_000000000000000000 && index < 252_000000000000000000) { payoutOption = _payoutOptions[3]; }
        if (index >= 252_000000000000000000) { payoutOption = _payoutOptions[4]; }

        payout = (limit / 100) * uint256(payoutOption);
    }

    /**
     * @notice This method trigger an oracle request
     * @dev Start a claims process for a token and a particular trigger event
     * @param tokenId The token id
     * @param eventId The weather event that could trigger a payout
     * @return requestId The oracle request id
     */
    function startClaimsProcess(uint256 tokenId, string memory eventId)
        public
        returns (bytes32 requestId)
    {
        require(claimedEvents[eventId][tokenId] == false, "ClaimsEngine: Claim processed for event already");
        Chainlink.Request memory request = buildChainlinkRequest(
            jobId,
            address(this),
            this.processClaimsData.selector
        );

        // The api handler should retrieve token properties for evaluating event from IPFS using the tokenURI
        //     ex. locationId, basinId, lossLimit
        string memory reqUrl = string(abi.encodePacked(claimsURI, "/evaluation.json?tokenId=", Strings.toString(tokenId), "&eventId=", eventId));

        // Set the URL to perform the GET request on
        request.add("get", reqUrl);

        // Set the path to find the desired data in the API response, where the response format is:
        // {"evaluation":
        //   {"result":
        //     {"vmax":
        //       {
        //         "kph": xxx.xxx,
        //         "mph": xxx.xxx,
        //       }
        //     }
        //   }
        // }
        request.add("path", "evaluation.result.vmax.kph");

        // Multiply the result by 1000000000000000000 to remove decimals
        int timesAmount = 10**18;
        request.addInt("times", timesAmount);

        // Sends the request
        requestId = sendChainlinkRequestTo(oracle, request, fee);
        requestTokens[requestId] = tokenId;
        requestEvents[requestId] = eventId;

        return requestId;
    }

    /**
     * @notice Callback from oracle with weather index value
     * @dev Deposits value in token escrow for any valid payout
     * @param requestId The oracle request id
     * @param index The weather index value
     */
    function processClaimsData(bytes32 requestId, uint256 index)
        public
        recordChainlinkFulfillment(requestId)
    {
        uint256 tokenId = requestTokens[requestId];
        string memory eventId = requestEvents[requestId];
        uint256 payout = calcPayout(index, payoutOptions[tokenId], termLimits[tokenId]);
        require(payout > 0, "ClaimsEngine: Only deposit valid payouts");
        require(balances[tokenId] >= payout, "ClaimsEngine: Not enough funds");

        // Always pay the min(payout, balance)
        if (payout > balances[tokenId]) {
            payout = balances[tokenId];
        }

        balances[tokenId] -= payout;
        riskPoolBalance -= payout;
        // Moves value to token escrow in WDT contract
        wdtToken.depositClaimPayout{value:payout}(tokenId, payout);

        claimedEvents[eventId][tokenId] = true;
    }

    /**
     * @dev Deposits value in risk pool for a minted token
     * @param tokenId The token id
     * @param _payoutOptions The payout ratios for the token
     */
    function depositPool(uint256 tokenId, uint[] memory _payoutOptions)
        payable
        public
        returns(bool)
    {
        require(wdtToken.exists(tokenId), "ClaimsEngine: Token does not exist");
        require(balances[tokenId] == 0, "ClaimsEngine: Can only deposit once, when minting");
        uint256 amount = msg.value;
        balances[tokenId] = amount;
        termLimits[tokenId] = amount;
        payoutOptions[tokenId] = _payoutOptions;
        riskPoolBalance += amount;
        return true;
    }

    /**
     * @notice Used to withdraw risk pool funds at the end of the covered period
     * @dev Withdraws `amount` from contract balance to owner
     * @param amount The amount of value to withdraw
     */
    function withdrawPool(uint256 amount)
        public
        onlyOwner
        returns(bool)
    {
        // TODO: UNCOMMENT TIMELOCK IN MAINNET
        // require(block.timestamp >= start + lockTime, "ClaimsEngine: Risk pool withdrawal not allowed yet");
        require(amount <= address(this).balance);

        riskPoolBalance -= amount;

        payable(owner()).transfer(amount);
        return true;
    }

    /**
     * @dev Withdraw any link amount so as to not lock the tokens in the contract
     */
    function withdrawLink()
        external
        onlyOwner
    {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());

        require(link.transfer(msg.sender, link.balanceOf(address(this))), "ClaimsEngine: Unable to transfer LINK");
    }
}