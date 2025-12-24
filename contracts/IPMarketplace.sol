// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Encrypted Intellectual Property Marketplace
 * 
 * Inventors can encrypt their invention descriptions,
 * buyers encrypt their interests, and deals happen without
 * revealing details until both parties agree.
 */
contract IPMarketplace {
    
    enum IPType {
        Patent,
        Trademark,
        TradeSecret,
        Copyright,
        Innovation
    }
    
    enum ListingStatus {
        Active,
        Sold,
        Cancelled
    }
    
    enum DealStatus {
        Pending,
        Accepted,
        Completed,
        Rejected
    }
    
    struct IPListing {
        uint256 id;
        address owner;
        IPType ipType;
        string title;
        bytes32 encryptedDescription; // FHE encrypted description
        bytes32 encryptedDetails; // Additional encrypted details
        uint256 price; // Price in wei
        ListingStatus status;
        uint256 createdAt;
    }
    
    struct BuyerInterest {
        uint256 id;
        address buyer;
        string category; // What type of IP they're looking for
        bytes32 encryptedInterests; // FHE encrypted buyer interests
        bytes32 encryptedCriteria; // What they're specifically looking for
        uint256 maxPrice; // Maximum price willing to pay
        uint256 createdAt;
        bool isActive;
    }
    
    struct Deal {
        uint256 id;
        uint256 listingId;
        uint256 interestId;
        address seller;
        address buyer;
        uint256 proposedPrice;
        bytes32 encryptedSellerData; // Additional encrypted seller info
        bytes32 encryptedBuyerData; // Additional encrypted buyer info
        DealStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }
    
    mapping(uint256 => IPListing) public listings;
    mapping(address => uint256[]) public sellerListings;
    mapping(uint256 => BuyerInterest) public buyerInterests;
    mapping(address => uint256[]) public buyerInterestIds;
    mapping(uint256 => Deal) public deals;
    mapping(address => uint256[]) public userDeals;
    
    uint256 public listingCounter;
    uint256 public interestCounter;
    uint256 public dealCounter;
    
    event IPListingCreated(
        uint256 indexed listingId,
        address indexed owner,
        IPType ipType,
        string title,
        uint256 price
    );
    
    event BuyerInterestCreated(
        uint256 indexed interestId,
        address indexed buyer,
        string category,
        uint256 maxPrice
    );
    
    event DealProposed(
        uint256 indexed dealId,
        uint256 indexed listingId,
        uint256 indexed interestId,
        address seller,
        address buyer,
        uint256 proposedPrice
    );
    
    event DealAccepted(
        uint256 indexed dealId,
        address indexed seller,
        address indexed buyer
    );
    
    event DealCompleted(
        uint256 indexed dealId,
        address indexed seller,
        address indexed buyer,
        uint256 finalPrice
    );
    
    event ListingStatusChanged(
        uint256 indexed listingId,
        ListingStatus newStatus
    );
    
    /**
     * Create a new IP listing
     */
    function createListing(
        IPType _ipType,
        string memory _title,
        bytes32 _encryptedDescription,
        bytes32 _encryptedDetails,
        uint256 _price
    ) external returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_encryptedDescription != bytes32(0), "Description cannot be empty");
        require(_price > 0, "Price must be greater than 0");
        
        uint256 listingId = listingCounter;
        listingCounter++;
        
        listings[listingId] = IPListing({
            id: listingId,
            owner: msg.sender,
            ipType: _ipType,
            title: _title,
            encryptedDescription: _encryptedDescription,
            encryptedDetails: _encryptedDetails,
            price: _price,
            status: ListingStatus.Active,
            createdAt: block.timestamp
        });
        
        sellerListings[msg.sender].push(listingId);
        
        emit IPListingCreated(listingId, msg.sender, _ipType, _title, _price);
        return listingId;
    }
    
    /**
     * Create buyer interest profile
     */
    function createBuyerInterest(
        string memory _category,
        bytes32 _encryptedInterests,
        bytes32 _encryptedCriteria,
        uint256 _maxPrice
    ) external returns (uint256) {
        require(bytes(_category).length > 0, "Category cannot be empty");
        require(_encryptedInterests != bytes32(0), "Interests cannot be empty");
        require(_maxPrice > 0, "Max price must be greater than 0");
        
        uint256 interestId = interestCounter;
        interestCounter++;
        
        buyerInterests[interestId] = BuyerInterest({
            id: interestId,
            buyer: msg.sender,
            category: _category,
            encryptedInterests: _encryptedInterests,
            encryptedCriteria: _encryptedCriteria,
            maxPrice: _maxPrice,
            createdAt: block.timestamp,
            isActive: true
        });
        
        buyerInterestIds[msg.sender].push(interestId);
        
        emit BuyerInterestCreated(interestId, msg.sender, _category, _maxPrice);
        return interestId;
    }
    
    /**
     * Propose a deal between listing and buyer interest
     */
    function proposeDeal(
        uint256 _listingId,
        uint256 _interestId,
        uint256 _proposedPrice,
        bytes32 _encryptedSellerData,
        bytes32 _encryptedBuyerData
    ) external returns (uint256) {
        IPListing storage listing = listings[_listingId];
        BuyerInterest storage interest = buyerInterests[_interestId];
        
        require(listing.owner != address(0), "Listing does not exist");
        require(listing.status == ListingStatus.Active, "Listing is not active");
        require(interest.buyer != address(0), "Buyer interest does not exist");
        require(interest.isActive, "Buyer interest is not active");
        require(listing.owner == msg.sender || interest.buyer == msg.sender, "Not authorized to propose deal");
        require(_proposedPrice > 0, "Proposed price must be greater than 0");
        require(_proposedPrice <= interest.maxPrice, "Price exceeds buyer's max price");
        
        uint256 dealId = dealCounter;
        dealCounter++;
        
        deals[dealId] = Deal({
            id: dealId,
            listingId: _listingId,
            interestId: _interestId,
            seller: listing.owner,
            buyer: interest.buyer,
            proposedPrice: _proposedPrice,
            encryptedSellerData: _encryptedSellerData,
            encryptedBuyerData: _encryptedBuyerData,
            status: DealStatus.Pending,
            createdAt: block.timestamp,
            completedAt: 0
        });
        
        userDeals[listing.owner].push(dealId);
        userDeals[interest.buyer].push(dealId);
        
        emit DealProposed(dealId, _listingId, _interestId, listing.owner, interest.buyer, _proposedPrice);
        return dealId;
    }
    
    /**
     * Accept a proposed deal
     */
    function acceptDeal(uint256 _dealId) external {
        Deal storage deal = deals[_dealId];
        
        require(deal.seller != address(0), "Deal does not exist");
        require(deal.status == DealStatus.Pending, "Deal is not pending");
        require(
            (msg.sender == deal.seller && deal.buyer != msg.sender) ||
            (msg.sender == deal.buyer && deal.seller != msg.sender),
            "Not authorized to accept this deal"
        );
        
        IPListing storage listing = listings[deal.listingId];
        require(listing.status == ListingStatus.Active, "Listing is no longer active");
        
        deal.status = DealStatus.Accepted;
        
        emit DealAccepted(_dealId, deal.seller, deal.buyer);
    }
    
    /**
     * Complete a deal (both parties agree)
     */
    function completeDeal(uint256 _dealId) external payable {
        Deal storage deal = deals[_dealId];
        
        require(deal.seller != address(0), "Deal does not exist");
        require(deal.status == DealStatus.Accepted, "Deal must be accepted first");
        require(msg.sender == deal.buyer, "Only buyer can complete the deal");
        require(msg.value >= deal.proposedPrice, "Insufficient payment");
        
        IPListing storage listing = listings[deal.listingId];
        require(listing.status == ListingStatus.Active, "Listing is no longer active");
        
        deal.status = DealStatus.Completed;
        deal.completedAt = block.timestamp;
        listing.status = ListingStatus.Sold;
        
        // Transfer payment to seller
        payable(deal.seller).transfer(deal.proposedPrice);
        
        // Refund excess payment
        if (msg.value > deal.proposedPrice) {
            payable(msg.sender).transfer(msg.value - deal.proposedPrice);
        }
        
        emit DealCompleted(_dealId, deal.seller, deal.buyer, deal.proposedPrice);
        emit ListingStatusChanged(deal.listingId, ListingStatus.Sold);
    }
    
    /**
     * Cancel a listing
     */
    function cancelListing(uint256 _listingId) external {
        IPListing storage listing = listings[_listingId];
        require(listing.owner == msg.sender, "Only owner can cancel listing");
        require(listing.status == ListingStatus.Active, "Listing is not active");
        
        listing.status = ListingStatus.Cancelled;
        emit ListingStatusChanged(_listingId, ListingStatus.Cancelled);
    }
    
    /**
     * Deactivate buyer interest
     */
    function deactivateInterest(uint256 _interestId) external {
        BuyerInterest storage interest = buyerInterests[_interestId];
        require(interest.buyer == msg.sender, "Only owner can deactivate interest");
        require(interest.isActive, "Interest is already inactive");
        
        interest.isActive = false;
    }
    
    /**
     * Get user's listings
     */
    function getSellerListings(address _seller) external view returns (uint256[] memory) {
        return sellerListings[_seller];
    }
    
    /**
     * Get user's buyer interests
     */
    function getBuyerInterests(address _buyer) external view returns (uint256[] memory) {
        return buyerInterestIds[_buyer];
    }
    
    /**
     * Get user's deals
     */
    function getUserDeals(address _user) external view returns (uint256[] memory) {
        return userDeals[_user];
    }
    
    /**
     * Get all active listings (simplified - returns up to limit)
     */
    function getActiveListings(uint256 _limit) external view returns (uint256[] memory) {
        uint256 count = 0;
        uint256[] memory result = new uint256[](_limit);
        
        for (uint256 i = 0; i < listingCounter && count < _limit; i++) {
            if (listings[i].status == ListingStatus.Active) {
                result[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory finalResult = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            finalResult[i] = result[i];
        }
        
        return finalResult;
    }
}

