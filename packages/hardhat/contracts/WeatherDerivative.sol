// This contract mints Weather Derivative Tokens.
pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/escrow/Escrow.sol";
import "./ClaimsEngine.sol";

contract WeatherDerivative is ERC721Enumerable, ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    // Token ids
    Counters.Counter private tokenIds;

    // Claims engine contract
    ClaimsEngine claimsEngine;

    // Optional mapping for token URIs
    mapping(uint256 => string) private tokenURIs;
    // Escrows, there is an escrow to keep payouts for each minted token
    mapping(uint256 => Escrow) private escrows;

    // Minimum collateral accepted to mint a token
    uint256 constant MinCollateral = 0.25 ether;

    constructor() ERC721("WeatherDerivative", "WDT") {}

    /**
     * @dev Getter for token payout balance
     * @param tokenId The token id 
     * @return The balance of payout deposits made to the escrow account
     */
    function getPayoutBalance(uint256 tokenId)
        external
        view
        returns(uint)
    {
        Escrow escrow = escrows[tokenId];
        return escrow.depositsOf(this.ownerOf(tokenId));
    }

    /**
     * @notice Copied from ERC721 metadata extension
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "WeatherDerivative: URI query for nonexistent token");

        string memory _tokenURI = tokenURIs[tokenId];
        string memory base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }

        return super.tokenURI(tokenId);
    }

    /**
     * @dev Setter for claims engine
     * @param claims The address for the deployed claims engine contract
     */
    function setClaimsEngine(address claims)
        public
        onlyOwner
    {
        require(address(claimsEngine) == address(0), "WeatherDerivative: Can only set the claims engine once");
        claimsEngine = ClaimsEngine(claims);
    }

    /**
     * @notice Copied from ERC721 metadata extension
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "WeatherDerivative: URI set of nonexistent token");
        tokenURIs[tokenId] = _tokenURI;
    }
    
    /**
     * @dev Mints a token for `to` address
     * @param to The destination address for the token
     * @param wdtTokenURI The IPFS URI for the token details 
     * @param payoutOptions The payout ratios for the weather index thresholds
     * @return The id for the newly minted token
     */
    function mintItem(address to, string memory wdtTokenURI, uint[] memory payoutOptions)
        public
        payable
        onlyOwner
        returns (uint256)
    {
        require(msg.value >= MinCollateral, "WeatherDerivative: Need to send more collateral");
        require(address(claimsEngine) != address(0), "WeatherDerivative: Claims engine location needs to be set");

        tokenIds.increment();

        uint256 id = tokenIds.current();
        // Create an escrow for each minted token
        escrows[id] = new Escrow();

        _mint(to, id);
        setTokenURI(id, wdtTokenURI);

        // Deposits `msg.value` into risk pool for minter as the payee
        claimsEngine.depositPool{value:msg.value}(id, payoutOptions);

        return id;
    }

    /**
     * @notice This method will be called from the ClaimsEngine contract
     * @dev Adds the `amount` of value to the token escrow
     * @param tokenId The token id
     * @param amount The value to deposit into token escrow
     */
    function depositClaimPayout(uint256 tokenId, uint256 amount)
        public
        payable
    {
        require(_exists(tokenId), "WeatherDerivative: Token does not exist");
        require(msg.sender == address(claimsEngine), "WeatherDerivative: Only claims engine allowed to deposit");
        require(msg.value == amount);
        // Get the token escrow
        Escrow escrow = escrows[tokenId];
        // Move any value sent to the token escrow
        escrow.deposit{value:amount}(this.ownerOf(tokenId));
    }

    /**
     * @dev Withdraw any balance in escrow toward the token owner
     * @param tokenId The token id
     */
    function withdrawClaimPayouts(uint256 tokenId)
        public
        nonReentrant
    {
        // Get the token escrow
        Escrow escrow = escrows[tokenId];
        // Move any value in escrow to owner of the token
        escrow.withdraw(payable(this.ownerOf(tokenId)));
    }

    /**
     * @dev Checks if `tokenId` exists
     * @param tokenId The token id 
     * @return existance of token
     */
    function exists(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }

    // Withdrawal by owner of any balance (eth) sent to the contract
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
