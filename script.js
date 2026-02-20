document.addEventListener("DOMContentLoaded", () => {
    try {
        // Surface runtime errors to console so initialization failures aren't silent
        window.addEventListener('error', (e) => { console.error('Runtime error:', e.error || e.message); });
        window.addEventListener('unhandledrejection', (e) => { console.error('Unhandled promise rejection:', e.reason); });

    // currency symbol for display
    const CURRENCY = '₦';
    const priceRegex = /[^0-9.]/g; // remove currency symbols/characters when parsing prices

    /* =====================
    |   VARIABLES           |
    ====================== */
    const categoryButtons = document.querySelectorAll(".side-item, .category-btn");
    let menuCards = document.querySelectorAll(".menu-card");
    const cartItemsContainer = document.querySelector(".cart-items");
    const totalAmount = document.getElementById("total-amount");
    const addButtons = document.querySelectorAll(".add-to-cart");

    let cart = [];
    let activeCategory = "Featured";
    const searchInput = document.getElementById("menu-search");
    let activeSearch = "";
    // lightweight cart count + icon (kept in DOMContentLoaded scope)
    let cartCount = 0;
    const cartIcon = document.querySelector(".cart-icon");
    const cartCountSpan = document.querySelector(".cart-count");

    /* =====================
    | AUTH (localStorage)   |
    | - foodhub-users       |
    | - foodhub-current-user
    ====================== */
    function getUsers() {
        try { return JSON.parse(localStorage.getItem('foodhub-users') || '[]'); } catch (e) { return []; }
    }

    function saveUsers(users) {
        try { localStorage.setItem('foodhub-users', JSON.stringify(users)); } catch (e) { console.error(e); }
    }

    function findUserByEmail(email) {
        if (!email) return null;
        const users = getUsers();
        return users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase()) || null;
    }

    function getLoggedInUser() {
        try { return JSON.parse(localStorage.getItem('foodhub-current-user') || 'null'); } catch (e) { return null; }
    }

    function saveUser(user) {
        if (!user || !user.email) return;
        const users = getUsers();
        const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (idx > -1) users[idx] = user; else users.push(user);
        saveUsers(users);
        try { localStorage.setItem('foodhub-current-user', JSON.stringify(user)); } catch (e) { console.error(e); }
    }

    function requireLogin() {
        const user = getLoggedInUser();
        if (!user) {
            // Redirect to login page (same-folder pages are under /Home/)
            window.location.href = 'login.html';
            return null;
        }
        return user;
    }

    /* =====================================
    | FEATURE 1: PRICE RANGE FILTER VARS   |
    ===================================== */
    let maxPrice = 30000; // Maximum price for filtering (matches slider range)
    const priceFilter = document.getElementById("price-filter");
    const priceValue = document.getElementById("price-value");

    /* =====================================
    | FEATURE 2: DIETARY FILTERS VARS      |
    ===================================== */
    let activeDietary = []; // Array of selected dietary filters
    const dietaryCheckboxes = document.querySelectorAll(".dietary-checkbox");
    const resetBtn = document.getElementById("reset-filters");

    /* =====================================
    | FEATURE 5: FAVORITES SYSTEM VARS     |
    ===================================== */
    let favorites = []; // Array to store favorite item names

    // Load favorites immediately (defensive against corrupt storage)
    loadFavorites(); // Load from localStorage on page load

    function loadFavorites() {
        try {
            const saved = localStorage.getItem('foodhub-favorites');
            favorites = saved ? JSON.parse(saved) : [];
        } catch (err) {
            console.warn('Failed to parse favorites from localStorage - clearing corrupt value', err);
            favorites = [];
            try { localStorage.removeItem('foodhub-favorites'); } catch (e) { /* ignore */ }
        }
    }

    function saveFavorites() {
        try {
            localStorage.setItem('foodhub-favorites', JSON.stringify(favorites));
        } catch (err) {
            console.error('Failed to save favorites to localStorage', err);
        }
    }

    /* =====================================
    | FEATURE 1: PRICE FILTER EVENT        |
    ===================================== */
    if (priceFilter) {
        priceFilter.addEventListener("input", function() {
            maxPrice = parseInt(this.value); // Update max price from slider
            if (priceValue) priceValue.textContent = CURRENCY + maxPrice; // Show selected price
            applyFilters(); // Reapply all filters with new price
        });
    }

    /* =====================================
    | FEATURE 2: DIETARY FILTER EVENTS     |
    ===================================== */
    dietaryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", function() {
            // Rebuild dietary array from all checked checkboxes
            activeDietary = Array.from(dietaryCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            applyFilters(); // Reapply filters with updated dietary selections
        });
    });

    // Reset filters button — clear all dietary & price filters
    if (resetBtn) {
        resetBtn.addEventListener("click", function() {
            // Uncheck all dietary checkboxes
            dietaryCheckboxes.forEach(cb => cb.checked = false);
            activeDietary = []; // Clear dietary filter array
            maxPrice = 30000; // Reset price to maximum
            if (priceFilter) {
                priceFilter.value = 30000;
                if (priceValue) priceValue.textContent = CURRENCY + "30 000";
            }
            applyFilters(); // Show all items
        });
    }

    // Apply all active filters to menu cards
    function applyFilters() {
        const term = (activeSearch || '').trim().toLowerCase();

        menuCards.forEach(card => {
            const category = (card.dataset.category || '');
            const title = (card.querySelector('h3')?.textContent || '').toLowerCase();
            const desc = (card.querySelector('p')?.textContent || '').toLowerCase();

            const itemPrice = parseFloat(card.querySelector('.price')?.textContent.replace(/[^0-9.]/g, '') || 0);
            const priceMatch = itemPrice <= maxPrice;

            let dietaryMatch = true;
            if (activeDietary.length > 0) {
                const itemTags = (card.dataset.dietaryTags || '').toLowerCase().split(/\s+/).filter(Boolean);
                dietaryMatch = activeDietary.some(d => itemTags.includes(d));
            }

            const matchesCategory = (activeCategory === 'Featured') || (category === activeCategory);
            const matchesSearch = term === '' || title.includes(term) || desc.includes(term);

            if (matchesCategory && matchesSearch && priceMatch && dietaryMatch) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Wire up category buttons (sticky nav) to update activeCategory and re-filter
    if (categoryButtons && categoryButtons.length) {
        categoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                activeCategory = button.textContent.trim();
                applyFilters();
            });
        });
    }

    // Search input handler — filter as user types
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            activeSearch = e.target.value || '';
            applyFilters();
        });
    }

    // Toggle favorite status for an item (add or remove from favorites)
    function toggleFavorite(itemName, button) {
        const index = favorites.indexOf(itemName);
        
        if (index > -1) {
            // Item already favorited — remove it
            favorites.splice(index, 1);
            button.classList.remove("active");
            button.textContent = "🤍"; // Empty heart
        } else {
            // Item not favorited — add it
            favorites.push(itemName);
            button.classList.add("active");
            button.textContent = "❤️"; // Solid heart
        }
        
        saveFavorites(); // Persist to localStorage
    }

    // Attach favorite button event listeners to all cards (defensive DOM access)
    function attachFavoriteHandlers() {
        const favoriteButtons = document.querySelectorAll(".favorite-btn");
        favoriteButtons.forEach(btn => {
            const card = btn.closest(".menu-card");
            const titleEl = card ? card.querySelector("h3") : null;
            if (!titleEl) return; // skip malformed buttons
            const itemName = titleEl.textContent || '';

            // Update button appearance if item is already favorited
            if (favorites.includes(itemName)) {
                btn.classList.add("active");
                btn.textContent = "❤️"; // Solid heart
            } else {
                btn.classList.remove("active");
                btn.textContent = "🤍"; // Empty heart
            }
            
            btn.addEventListener("click", function(e) {
                e.preventDefault();
                toggleFavorite(itemName, this);
            });
        });
    }

    // Call this after page loads and whenever favorites change
    attachFavoriteHandlers();

    /* ==========================================
    | FEATURE 6: PROMO CODE SYSTEM FUNCTIONS   |
    ========================================== */

    // Apply promo code button handler
    const applyPromoBtn = document.getElementById("apply-promo");
    if (applyPromoBtn) {
        applyPromoBtn.addEventListener("click", function() {
            const promoCode = document.getElementById("promo-code").value.trim();
            applyPromoCode(promoCode);
        });
    }

    // Validate and apply promo code with discount
    function applyPromoCode(code) {
        const promoMessage = document.getElementById("promo-message");
        const promoInput = document.getElementById("promo-code");
        
        // Define valid promo codes and their discount percentages
        const validCodes = {
            "SAVE20": { discount: 20, description: "20% off" },
            "WELCOME10": { discount: 10, description: "10% off" },
            "FOODIE15": { discount: 15, description: "15% off" },
            "FIRSTORDER50": { discount: 50, description: "50% off" }
        };
        
        if (!code) {
            if (promoMessage) {
                promoMessage.textContent = "Please enter a promo code";
                promoMessage.classList.remove("success", "error");
            }
            return;
        }
        
        const upperCode = code.toUpperCase();
        
        // Check if code is valid
        if (validCodes[upperCode]) {
            const promoData = validCodes[upperCode];
            
            // Calculate discount amount based on cart subtotal
            const subtotal = calculateSubtotal();
            const discountAmount = (subtotal * promoData.discount) / 100;
            
            // Display success message with discount details
            if (promoMessage) {
                promoMessage.textContent = `✓ Discount applied! ${promoData.description} - Save ${CURRENCY}${discountAmount.toFixed(2)}`;
                promoMessage.classList.add("success");
                promoMessage.classList.remove("error");
            }
            
            // Update cart total with discount applied
            updateCartTotal(discountAmount);
            
            // Disable input after successfully applying code
            if (promoInput) promoInput.disabled = true;
        } else {
            // Display error for invalid code
            if (promoMessage) {
                promoMessage.textContent = `✗ Invalid promo code: "${code}"`;
                promoMessage.classList.add("error");
                promoMessage.classList.remove("success");
            }
            updateCartTotal(0); // No discount
        }
    }

    // Calculate cart subtotal (sum of all items before tax & discount)
    function calculateSubtotal() {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    // Update total price display with optional discount
    function updateCartTotal(discount = 0) {
        const subtotal = calculateSubtotal();
        const total = subtotal - discount;
        
        if (totalAmount) {
            totalAmount.textContent = CURRENCY + total.toFixed(2);
        }
    }

    /* =====================
    |   ADD TO CART         |
    ====================== */
    addButtons.forEach(button => {
        button.addEventListener("click", () => {
            let name, price;

            // Check if this is a menu card or a carousel item
            const menuCard = button.closest(".menu-card");
            const carouselItem = button.closest(".carousel-item");

            if (menuCard) {
                // Extract from menu card structure
                name = menuCard.querySelector("h3")?.textContent || "Unknown Item";
                price = Number(
                    menuCard.querySelector(".price")?.textContent.replace(priceRegex, "") || 0
                );
            } else if (carouselItem) {
                // Extract from carousel item structure
                name = carouselItem.querySelector("h4")?.textContent || "Chef's Pick";
                price = Number(
                    carouselItem.querySelector(".carousel-price")?.textContent.replace(priceRegex, "") || 0
                );
            } else {
                console.warn("Add to cart: could not find menu-card or carousel-item");
                return;
            }

            const existingItem = cart.find(item => item.name === name);

            if (existingItem) {
                existingItem.quantity++;
            } else {
                cart.push({
                    name,
                    price,
                    quantity: 1
                });
            }

            updateCartUI();
        });
    });

    /* =====================
    |          CART UI      |
    ====================== */
    function updateCartUI() {
        cartItemsContainer.innerHTML = "";
        let total = 0;

        cart.forEach(item => {
            total += item.price * item.quantity;

            const div = document.createElement("div");
            div.classList.add("cart-item");

            div.innerHTML = `
                <span class="cart-name">${item.name}</span>

                <div class="cart-controls">
                    <button class="qty-btn minus">−</button>
                    <span class="qty">${item.quantity}</span>
                    <button class="qty-btn plus">+</button>
                </div>

                <span class="cart-price">${CURRENCY}${(item.price * item.quantity).toFixed(2)}</span>
            `;

            cartItemsContainer.appendChild(div);

            // Add click handler for nutrition info
            const nameSpan = div.querySelector(".cart-name");
            if (nameSpan) {
                nameSpan.addEventListener("click", () => {
                    showNutritionInfo(item.name);
                });
            }

            // Quantity buttons
            const plusBtn = div.querySelector(".plus");
            const minusBtn = div.querySelector(".minus");

            plusBtn.addEventListener("click", () => {
                item.quantity++;
                updateCartUI();
            });

            minusBtn.addEventListener("click", () => {
                item.quantity--;
                if (item.quantity <= 0) {
                    cart = cart.filter(cartItem => cartItem !== item);
                }
                updateCartUI();
            });
        });
        totalAmount.textContent = `${CURRENCY}${total.toFixed(2)}`;

        // cart count (sum of quantities) and reflect on cart icon
        const prevCount = cartCount;
        const totalQty = cart.reduce((sum, it) => sum + (it.quantity || 0), 0);
        cartCount = totalQty;
        if (cartCountSpan) cartCountSpan.textContent = cartCount;

        // Bounce animation when items are added
        if (cartIcon && prevCount < cartCount) {
            cartIcon.classList.remove('cart-bounce');
            void cartIcon.offsetWidth;
            cartIcon.classList.add('cart-bounce');
        }

        // Update loyalty points
        updateLoyaltyPoints(total);

        // Update prep time estimator
        updatePrepTimeEstimator();

        // Update combo suggestions
        generateComboSuggestions();

        // Show order tracker if items in cart
        showOrderTracker();
    }

    /* ==========================================
    | FEATURE: LOYALTY POINTS SYSTEM           |
    ========================================== */
    function updateLoyaltyPoints(totalAmount) {
        // If a user is logged in, show their persisted points; otherwise show ephemeral cart points
        const loyaltySection = document.querySelector(".loyalty-section");
        const loyaltyPointsSpan = document.querySelector(".loyalty-points");
        if (!loyaltySection || !loyaltyPointsSpan) return;

        const user = getLoggedInUser();
        if (user && typeof user.points === 'number') {
            loyaltySection.style.display = "flex";
            loyaltyPointsSpan.textContent = (user.points || 0) + " pts";
            return;
        }

        // convert amount into points at 1 point per ₦1 000
        const loyaltyPoints = Math.floor(totalAmount / 1000);
        if (totalAmount > 0) {
            loyaltySection.style.display = "flex";
            loyaltyPointsSpan.textContent = loyaltyPoints + " pts";
        } else {
            loyaltySection.style.display = "none";
        }
    }

    /* ==========================================
    | FEATURE: SMART PREP TIME ESTIMATOR       |
    ========================================== */
    function updatePrepTimeEstimator() {
        const prepTimeWidget = document.getElementById("prep-time-widget");
        const prepTimeDisplay = document.getElementById("prep-time-display");

        if (!prepTimeWidget || !prepTimeDisplay) return;

        if (cart.length === 0) {
            prepTimeWidget.classList.remove("active");
            return;
        }

        // Sum prep time for all items in cart (based on data-prep-time attribute)
        let totalPrepTime = 0;
        cart.forEach(item => {
            // Find original menu card to get prep time
            const allCards = document.querySelectorAll('.menu-card, .carousel-item');
            let itemCard = null;
            
            for (let card of allCards) {
                const titleEl = card.querySelector('h3') || card.querySelector('h4');
                if (titleEl && titleEl.textContent.trim() === item.name) {
                    itemCard = card;
                    break;
                }
            }

            if (itemCard) {
                const prepTime = parseInt(itemCard.dataset.prepTime || 10);
                totalPrepTime = Math.max(totalPrepTime, prepTime); // Take the max prep time
            } else {
                // Default prep time if not found
                totalPrepTime = Math.max(totalPrepTime, 10);
            }
        });

        // Add buffer time based on number of items
        const bufferTime = Math.ceil(cart.length / 2) * 2; // 2 mins per 2 items
        totalPrepTime += bufferTime;

        prepTimeWidget.classList.add("active");
        // convert minutes into hours/minutes string
        let displayStr;
        const hrs = Math.floor(totalPrepTime / 60);
        const mins = totalPrepTime % 60;
        if (hrs > 0) displayStr = `${hrs}h ${mins}m`;
        else displayStr = `${mins}m`;
        prepTimeDisplay.textContent = "Ready in " + displayStr;
    }

    /* ==========================================
    | FEATURE: SMART COMBO SUGGESTIONS         |
    ========================================== */
    function generateComboSuggestions() {
        const comboBanner = document.getElementById("combo-banner");
        const comboItemsContainer = document.getElementById("combo-banner-items");

        if (!comboBanner || !comboItemsContainer) return;

        if (cart.length === 0) {
            comboBanner.classList.remove("active");
            return;
        }

        // Check for missing items in a typical meal combo
        const cartItemNames = cart.map(item => item.name.toLowerCase());
        const hasMainCourse = cartItemNames.some(name => 
            name.includes("burger") || name.includes("chicken") || name.includes("pizza") || name.includes("pasta")
        );
        const hasDrink = cartItemNames.some(name => 
            name.includes("drink") || name.includes("cola") || name.includes("juice") || name.includes("water")
        );
        const hasDessert = cartItemNames.some(name => 
            name.includes("dessert") || name.includes("cake") || name.includes("ice cream")
        );

        const suggestions = [];

        if (hasMainCourse && !hasDrink) {
            suggestions.push({
                name: "Add a Drink",
                savings: `Save ${CURRENCY}1 500`
            });
        }

        if (hasMainCourse && !hasDessert) {
            suggestions.push({
                name: "Add a Dessert",
                savings: `Save ${CURRENCY}2 000`
            });
        }

        // if user has a main course but missing both drink and dessert, show ultimate offer
        if (hasMainCourse && !hasDrink && !hasDessert) {
            suggestions.push({
                name: "Ultimate Combo Deal",
                savings: `Save ${CURRENCY}5 000`
            });
        }

        // Render suggestions in banner
        comboItemsContainer.innerHTML = "";
        suggestions.forEach(suggestion => {
            const suggestionDiv = document.createElement("div");
            suggestionDiv.classList.add("combo-banner-item");
            suggestionDiv.innerHTML = `
                <div class="combo-banner-item-name">🎉 ${suggestion.name}</div>
                <div class="combo-banner-item-savings">${suggestion.savings}</div>
            `;
            comboItemsContainer.appendChild(suggestionDiv);
        });

        if (suggestions.length === 0) {
            comboBanner.classList.remove("active");
        } else {
            comboBanner.classList.add("active");
        }
    }

    /* ==========================================
    | FEATURE: NUTRITION INFO SYSTEM           |
    ========================================== */
    
    // Nutrition database for menu items
    const nutritionDatabase = {
        "Grilled Chicken": {
            calories: 450,
            protein: 52,
            carbs: 0,
            fat: 25,
            allergens: ["Poultry"]
        },
        "Double Cheese-Burger": {
            calories: 680,
            protein: 38,
            carbs: 48,
            fat: 35,
            allergens: ["Gluten", "Dairy", "Beef"]
        },
        "Pepperoni Pizza": {
            calories: 520,
            protein: 28,
            carbs: 58,
            fat: 22,
            allergens: ["Gluten", "Dairy", "Pork"]
        },
        "Margherita Pizza": {
            calories: 480,
            protein: 24,
            carbs: 56,
            fat: 18,
            allergens: ["Gluten", "Dairy"]
        },
        "Vegetable Steak": {
            calories: 380,
            protein: 28,
            carbs: 42,
            fat: 14,
            allergens: ["Sesame"]
        },
        "Coca Cola": {
            calories: 140,
            protein: 0,
            carbs: 39,
            fat: 0,
            allergens: []
        },
        "Chocolate Cake": {
            calories: 350,
            protein: 6,
            carbs: 52,
            fat: 16,
            allergens: ["Gluten", "Dairy", "Eggs"]
        },
        "Gourmet Burger": {
            calories: 450,
            protein: 52,
            carbs: 0,
            fat: 25,
            allergens: ["Chesse"]
        },
    };

    function showNutritionInfo(itemName) {
        const modal = document.getElementById("nutrition-modal");
        const itemNameEl = document.getElementById("nutrition-item-name");
        const bodyEl = document.getElementById("nutrition-info-body");

        const nutrition = nutritionDatabase[itemName];
        if (!nutrition) {
            bodyEl.innerHTML = "<p>Nutrition info not available for this item.</p>";
        } else {
            let allergenHTML = "";
            if (nutrition.allergens.length > 0) {
                allergenHTML = `
                    <div class="allergen-warning">
                        <strong>⚠️ Allergen Warning:</strong>
                        Contains: ${nutrition.allergens.join(", ")}
                    </div>
                `;
            }

            bodyEl.innerHTML = `
                <div class="nutrition-info-item">
                    <span class="nutrition-info-label">🔥 Calories</span>
                    <span class="nutrition-info-value">${nutrition.calories} kcal</span>
                </div>
                <div class="nutrition-info-item">
                    <span class="nutrition-info-label">💪 Protein</span>
                    <span class="nutrition-info-value">${nutrition.protein}g</span>
                </div>
                <div class="nutrition-info-item">
                    <span class="nutrition-info-label">🌾 Carbs</span>
                    <span class="nutrition-info-value">${nutrition.carbs}g</span>
                </div>
                <div class="nutrition-info-item">
                    <span class="nutrition-info-label">🧈 Fat</span>
                    <span class="nutrition-info-value">${nutrition.fat}g</span>
                </div>
                ${allergenHTML}
            `;
        }

        itemNameEl.textContent = itemName;
        modal.classList.add("active");
    }

    /* ==========================================
    | FEATURE: LIVE ORDER TRACKER              |
    ========================================== */
    
    let currentOrderStep = 0;
    const orderSteps = ["confirmed", "preparing", "ready"];

    function showOrderTracker() {
        // Order tracker removed - features moved to floating widgets
        // This is kept for compatibility but does nothing
    }

    function simulateOrderProgress() {
        // Order tracker removed - features moved to floating widgets
    }

    function updateOrderStepUI() {
        // Order tracker removed - features moved to floating widgets
    }

    // Cart icon toggle (uses elements present in DOM)
    const myCartIcon = document.querySelector(".cart-icon");
    const myCartSidebar = document.querySelector(".cart");
    if (myCartIcon && myCartSidebar) {
        myCartIcon.addEventListener("click", () => {
            myCartSidebar.classList.toggle("active");
        });
    }

    /* ==========================================
    | LIVE CHAT WIDGET - KEYWORD DETECTION    |
    ========================================== */
    
    // Keyword-based response map for AI-like chat
    const chatKeywordResponses = {
        'pizza': '🍕 Our signature pizzas are wood-fired and made fresh! Try our Margherita or Pepperoni. Perfect combo with a drink!',
        'delivery': `🚗 We deliver in 30-45 minutes! Free delivery on orders over ${CURRENCY}20. Your food arrives hot & fresh.`,

        'payment': '💳 We accept all major credit/debit cards, mobile money, and cash on delivery. Safe & secure!',
        'menu': '📋 Check out our full menu above! We have pizzas, burgers, pasta, sandwiches, and more. Something for everyone!',
        'price': `💰 Most items range from ${CURRENCY}5-${CURRENCY}20. Check the prices on the menu items above. We also have promo codes!`,

        'promo': '🎉 Try our promo codes: SAVE20 (20% off), WELCOME10 (10% off), FOODIE15 (15% off), FIRSTORDER50 (50% off)!',
        'hours': '⏰ We\'re open Mon-Sun, 11 AM - 11 PM. Order anytime and we\'ll deliver hot!',
        'veggie': '🥗 We have delicious vegetarian options! Try our Margherita Pizza or Vegetable Steak. Lots of dietary options!',
        'allergy': '⚠️ Important! Click on menu items to see detailed allergen info. We take allergies seriously for your safety!',
        'help': '👋 You can browse the menu, add items to cart, apply promo codes, and checkout. Need something specific? Ask away!',
        'order': '📦 Click "Checkout" to place your order. You\'ll need to log in first. Fast & easy!',
        'account': '👤 Create an account to track your orders, earn loyalty points, and check order history!',
        'points': `⭐ Earn 1 loyalty point per ${CURRENCY}1 000 spent! Bronze (0-99 pts), Silver (100-299), Gold (300-499), Platinum (500+). Check your dashboard!`
    };

    function findChatResponse(userMessage) {
        // Lowercase message for keyword matching
        const msg = userMessage.toLowerCase();
        
        // Check each keyword
        for (const [keyword, response] of Object.entries(chatKeywordResponses)) {
            if (msg.includes(keyword)) {
                return response;
            }
        }
        
        // Default response if no keywords match
        return '👋 Thanks for reaching out! We\'re here to help. You can ask about menu items, delivery, pricing, promos, allergies, or anything else!';
    }

    const liveChatWidget = document.getElementById("live-chat");
    let chatExpanded = false;

    // Click handler to toggle chat expand/collapse
    if (liveChatWidget) {
        liveChatWidget.addEventListener("click", (e) => {
            // Prevent triggering if clicking close button
            if (e.target.classList.contains("chat-close")) return;
            
            chatExpanded = !chatExpanded;
            if (chatExpanded) {
                liveChatWidget.classList.add("expanded");
                // Focus input when expanded
                const inputField = liveChatWidget.querySelector(".chat-text");
                if (inputField) inputField.focus();
            } else {
                liveChatWidget.classList.remove("expanded");
            }
        });

        // Handle send button click
        const sendBtn = liveChatWidget.querySelector(".chat-send");
        const chatInput = liveChatWidget.querySelector(".chat-text");
        
        if (sendBtn && chatInput) {
            sendBtn.addEventListener("click", () => {
                const message = chatInput.value.trim();
                if (message) {
                    // Get AI response based on keywords
                    const aiResponse = findChatResponse(message);
                    
                    // Clear input
                    chatInput.value = "";
                    
                    // Update chat message with AI response + small pulse animation
                    const chatMsg = liveChatWidget.querySelector(".chat-message");
                    if (chatMsg) {
                        chatMsg.textContent = aiResponse;
                        chatMsg.classList.add('chat-pulse');
                        setTimeout(() => chatMsg.classList.remove('chat-pulse'), 800);
                    }

                    // Reset to default after 6 seconds
                    setTimeout(() => {
                        if (chatMsg) {
                            chatMsg.textContent = "We're here to assist you! 👋";
                        }
                    }, 6000);
                }
            });

            // Allow Enter key to send
            chatInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    sendBtn.click();
                }
            });
        }
    }

    // Monitor cart state and hide live chat when cart is open
    if (myCartSidebar && liveChatWidget) {
        // Create a MutationObserver to watch for .active class changes on cart
        const cartObserver = new MutationObserver(() => {
            if (myCartSidebar.classList.contains("active")) {
                // Cart is open - hide live chat
                liveChatWidget.style.display = "none";
            } else {
                // Cart is closed - show live chat
                liveChatWidget.style.display = "flex";
            }
        });

        // Start observing changes to the cart's class attribute
        cartObserver.observe(myCartSidebar, { attributes: true, attributeFilter: ["class"] });

        /* ==========================================
        | CHEF'S PICKS CAROUSEL                     |
        ========================================== */
        const chefsCarousel = document.querySelector(".chefs-carousel");
        const chefsPrevBtn = document.getElementById("chefs-prev");
        const chefsNextBtn = document.getElementById("chefs-next");

        if (chefsCarousel && chefsPrevBtn && chefsNextBtn) {
            const carouselItems = chefsCarousel.querySelectorAll(".carousel-item");
            let currentIndex = 0;
            const gap = 20;

            // Function to scroll carousel
            function scrollCarousel(direction) {
                const carouselWidth = chefsCarousel.offsetWidth;
                const itemWidth = carouselItems[0]?.offsetWidth || 300;
                const maxScroll = Math.max(0, carouselItems.length - Math.floor(carouselWidth / (itemWidth + gap)));
            
                if (direction === "next") {
                    currentIndex = Math.min(currentIndex + 1, maxScroll);
                } else {
                    currentIndex = Math.max(currentIndex - 1, 0);
                }
                const scrollAmount = currentIndex * (itemWidth + gap);
                chefsCarousel.scrollLeft = scrollAmount;
                updateButtonStates();
            }

            chefsPrevBtn.addEventListener("click", () => scrollCarousel("prev"));
            chefsNextBtn.addEventListener("click", () => scrollCarousel("next"));

            // Update button states based on scroll position
            function updateButtonStates() {
                const carouselWidth = chefsCarousel.offsetWidth;
                const itemWidth = carouselItems[0]?.offsetWidth || 300;
                const maxScroll = Math.max(0, carouselItems.length - Math.floor(carouselWidth / (itemWidth + gap)));
            
                chefsPrevBtn.disabled = currentIndex === 0;
                chefsNextBtn.disabled = currentIndex === maxScroll;
                chefsPrevBtn.style.opacity = currentIndex === 0 ? "0.5" : "1";
                chefsNextBtn.style.opacity = currentIndex === maxScroll ? "0.5" : "1";
            }
            updateButtonStates();

            // Update button states on window resize
            window.addEventListener("resize", updateButtonStates);
        }
    }

    // Smooth anchor scrolling (guard target existence)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        const href = anchor.getAttribute("href");
        if (!href || href === "#") return; // Skip empty or bare # anchors
        try {
            const target = document.querySelector(href);
            if (!target) return;
            anchor.addEventListener("click", e => {
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth" });
            });
        } catch (err) {
            // Invalid selector, skip this anchor
            console.debug('Invalid anchor selector:', href);
        }
    });

    /* ==========================================
    | RECEIPT GENERATOR FUNCTION                |
    ========================================== */
    // Generate and display receipt in new window or in-page modal
    function generateReceipt() {
        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }

        const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();

        // Build receipt HTML header and open tbody for rows
        let receiptInner = `
            <div class="receipt">
                <h1>🍔 FoodHub Receipt</h1>
                <hr>
                <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Order Time:</strong> ${new Date().toLocaleTimeString()}</p>
                <hr>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Add cart items rows
        cart.forEach(item => {
            const itemTotal = (item.price * item.quantity).toFixed(2);
            receiptInner += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${CURRENCY}${item.price.toFixed(2)}</td>
                    <td>${CURRENCY}${itemTotal}</td>
                </tr>
            `;
        });

        // Totals
        const subtotal = calculateSubtotal();
        const tax = subtotal * 0.1; // 10% tax
        const total = subtotal + tax;

        // Loyalty / customer info for receipt
        const currentUser = getLoggedInUser();
        // compute points earned at 1 point per ₦1 000
        const pointsEarned = Math.floor((subtotal || 0) / 1000);
        const totalPointsAfter = (currentUser ? ((currentUser.points || 0) + pointsEarned) : pointsEarned);
        const customerEmail = currentUser ? currentUser.email : 'Guest';

        receiptInner += `
                    </tbody>
                </table>

                <hr>
                <table>
                    <tr>
                        <td><strong>Subtotal:</strong></td>
                        <td><strong>${CURRENCY}${subtotal.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                        <td><strong>Tax (10%):</strong></td>
                        <td><strong>${CURRENCY}${tax.toFixed(2)}</strong></td>
                    </tr>
                    <tr class="total-row">
                        <td>TOTAL:</td>
                        <td>${CURRENCY}${total.toFixed(2)}</td>
                    </tr>
                </table>

                <div style="margin-top:12px; padding:10px; background:#fff7e6; border-radius:8px; border:1px solid #ffe0b2;">
                    <div><strong>Customer:</strong> ${customerEmail}</div>
                    <div><strong>Points earned:</strong> ${pointsEarned} pts</div>
                    <div><strong>Total points:</strong> ${totalPointsAfter} pts</div>
                </div>

                <div class="footer">
                    <p>Thank you for ordering from FoodHub!</p>
                    <p>Expected delivery time: 30-45 minutes</p>
                    <p>Order ID: #${orderId}</p>
                </div>
            </div>
        `;

        // Try opening in a new window; fall back to in-page modal if blocked
        try {
            const receiptWindow = window.open('', '_blank');
            if (receiptWindow) {
                const doc = receiptWindow.document;
                doc.open();
                doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt - FoodHub</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;background:#f5f5f5} .receipt{background:#fff;width:420px;margin:0 auto;padding:20px;box-shadow:0 0 10px rgba(0,0,0,0.1)} h1{text-align:center;color:#ff4d4d} hr{border:none;border-top:2px dashed #ccc} table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:8px;border-bottom:1px solid #eee} th{background:#fff3e0;font-weight:bold} .total-row{background:#fff3e0;font-weight:bold;font-size:16px} .footer{text-align:center;margin-top:20px;color:#666;font-size:12px}</style></head><body>${receiptInner}</body></html>`);
                doc.close();
            } else {
                showReceiptModal(receiptInner);
                alert('Popup blocked. Showing receipt in-page. Allow popups for a new window.');
            }
        } catch (err) {
            console.error('Failed to open receipt window:', err);
            showReceiptModal(receiptInner);
            alert('Unable to open a new window. Receipt shown here.');
        }

        // Save order to localStorage order history before clearing cart
        const orderObj = {
            id: orderId,
            date: new Date().toISOString(),
            items: cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
            subtotal: subtotal,
            tax: tax,
            total: total
        };
        // save order to local history
        saveOrderToHistory(orderObj);

        // Save order to logged-in user's account and award points
        if (currentUser) {
            currentUser.orders = currentUser.orders || [];
            // include a record of the order with timestamp
            currentUser.orders.unshift(orderObj);

            // Award loyalty points at rate 1 point per ₦1 000 of subtotal
            const pointsEarned = Math.floor((subtotal || 0) / 1000);
            currentUser.points = (currentUser.points || 0) + pointsEarned;

            // persist user
            saveUser(currentUser);
        }

        // Clear cart after checkout
        cart = [];
        updateCartUI();
        alert("Order placed successfully!");
    }

    /* ==========================================
    | ORDER HISTORY / ACCOUNT (localStorage)   |
    ========================================== */
    function saveOrderToHistory(order) {
        try {
            const key = 'foodhub-orders';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.unshift(order); // newest first
            // keep last 100 orders
            localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
        } catch (err) {
            console.error('Failed to save order to history', err);
        }
    }

    function loadOrdersFromHistory() {
        try {
            return JSON.parse(localStorage.getItem('foodhub-orders') || '[]');
        } catch (err) {
            return [];
        }
    }

    // Legacy Account modal / Order-history UI removed. Use Login/Signup pages and server-backed account features instead.
    // Note: `reorderFromHistory` remains available for other UI to call if needed.
    // createAccountAndLinkOrder removed (legacy account-linking used localStorage). New authentication will handle account creation and order linking.
    // Legacy account storage and local loyalty persistence removed.
    // Server-backed Login/Signup will manage accounts and persisted loyalty points.

    // Helper to show receipt inside the page as a modal overlay
    function showReceiptModal(innerHTML) {
        let modal = document.getElementById('receipt-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'receipt-modal';
            modal.innerHTML = `
                <div class="receipt-modal-overlay"></div>
                <div class="receipt-modal-content">
                    <button class="receipt-close">&times;</button>
                    <div class="receipt-body"></div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.receipt-close').addEventListener('click', () => {
                modal.remove();
                document.getElementById('receipt-modal').remove();
            });
            modal.querySelector('.receipt-modal-overlay').addEventListener('click', () => {
                modal.remove();
                document.getElementById('receipt-modal').remove();
            });
        }
        const receiptBody = modal.querySelector('.receipt-body');
        if (receiptBody) {
            receiptBody.innerHTML = innerHTML;
        }
        // Ensure modal is visible
        modal.style.display = 'flex';
    }

    // PAYMENT: Show payment simulation modal, then complete order on success
    function showPaymentModal(onSuccess) {
        const subtotal = calculateSubtotal();
        const tax = +(subtotal * 0.10).toFixed(2);
        const total = +(subtotal + tax).toFixed(2);

        const modal = document.createElement('div');
        modal.className = 'payment-modal-overlay';
        modal.innerHTML = `
            <div class="payment-modal-content">
                <button class="payment-close" aria-label="Close">&times;</button>
                <h3>Secure Payment</h3>
                <div class="payment-summary">
                    <div><strong>Subtotal</strong><span>${CURRENCY}${subtotal.toFixed(2)}</span></div>
                    <div><strong>Tax (10%)</strong><span>${CURRENCY}${tax.toFixed(2)}</span></div>
                    <div class="total-row"><strong>Total</strong><span>${CURRENCY}${total.toFixed(2)}</span></div>
                </div>

                <div class="payment-methods">
                    <label><input type="radio" name="pmethod" value="card" checked> Credit / Debit Card</label>
                    <label><input type="radio" name="pmethod" value="mobile"> Mobile Money</label>
                    <label><input type="radio" name="pmethod" value="cash"> Cash on Delivery</label>
                </div>

                <div class="card-fields" id="card-fields">
                    <input placeholder="Card number" class="pm-input" maxlength="19">
                    <div style="display:flex; gap:8px;">
                        <input placeholder="MM/YY" class="pm-input" style="flex:1">
                        <input placeholder="CVC" class="pm-input" style="width:90px">
                    </div>
                </div>

                <div class="payment-actions">
                    <button class="payment-cancel">Cancel</button>
                    <button class="payment-pay primary">Pay ${CURRENCY}${total.toFixed(2)}</button>
                </div>

                <div class="payment-status" aria-hidden="true" style="display:none; text-align:center; margin-top:12px;">
                    <div class="payment-spinner" aria-hidden="true"></div>
                    <div class="payment-text" style="margin-top:8px; color:#666;">Processing payment...</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.payment-close');
        const cancelBtn = modal.querySelector('.payment-cancel');
        const payBtn = modal.querySelector('.payment-pay');
        const methods = modal.querySelectorAll('input[name="pmethod"]');
        const cardFields = modal.querySelector('#card-fields');
        const statusArea = modal.querySelector('.payment-status');

        function closeModal() { modal.remove(); }
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        methods.forEach(m => m.addEventListener('change', () => {
            if (m.value === 'card' && m.checked) cardFields.style.display = 'block';
            else cardFields.style.display = 'none';
        }));

        payBtn.addEventListener('click', async () => {
            // Simple validation: if card selected, require non-empty card input
            const method = Array.from(methods).find(x => x.checked)?.value || 'card';
            if (method === 'card') {
                const cardNum = modal.querySelector('.pm-input')?.value.trim() || '';
                if (cardNum.length < 8) { alert('Please enter a valid card number (demo).'); return; }
            }

            // Show processing UI
            payBtn.disabled = true; cancelBtn.disabled = true; closeBtn.disabled = true;
            statusArea.style.display = 'block';

            // Simulate network / payment processing delay
            await new Promise(r => setTimeout(r, 1600));

            // Simulate success animation
            statusArea.querySelector('.payment-text').textContent = 'Payment successful! Preparing receipt...';
            statusArea.querySelector('.payment-spinner').classList.add('payment-success');

            // Short delay then call success callback (generate receipt)
            setTimeout(() => {
                closeModal();
                onSuccess && onSuccess();
            }, 900);
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Checkout button delegates to payment simulation -> receipt generator
    function onCheckoutClick(e) {
        e.preventDefault();

        // Require login before checkout
        const user = getLoggedInUser();
        if (!user) {
            // redirect to login page (user will log in and return)
            window.location.href = 'login.html';
            return;
        }

        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        // Show payment simulation modal, then finalize order on success
        showPaymentModal(() => generateReceipt());
    }

    // Attach to ID if present
    const checkoutBtnById = document.getElementById('checkout-btn');
    if (checkoutBtnById) {
            checkoutBtnById.addEventListener('click', onCheckoutClick);
        }

        // Also attach to any elements with the class in case multiple buttons exist
        const checkoutBtns = document.querySelectorAll('.checkout-btn');
        checkoutBtns.forEach(btn => {
            // Avoid double-binding the element with ID
            if (btn.id === 'checkout-btn') return;
            btn.addEventListener('click', onCheckoutClick);
        });

    /* ==========================================
    | FEATURE: NUTRITION INFO TOOLTIP          |
    ========================================== */
    const nutritionInfoElements = document.querySelectorAll('.nutrition-info');
    nutritionInfoElements.forEach(element => {
        element.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const calories = this.dataset.calories || 'N/A';
            const protein = this.dataset.protein || 'N/A';
            const allergens = this.dataset.allergens || 'None detected';
            
            // Get item name from parent card
            const card = this.closest('.menu-card');
            const itemName = card ? card.querySelector('h3')?.textContent : 'Item';
            
            // Parse allergens
            const allergenList = allergens.split(',').map(a => a.trim().charAt(0).toUpperCase() + a.trim().slice(1)).join(', ');
            
            // Create and show nutrition modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    max-width: 400px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    font-family: Arial, sans-serif;
                ">
                    <h2 style="margin: 0 0 16px 0; color: #ff4d4d;">${itemName}</h2>
                    <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
                    
                    <div style="margin: 12px 0;">
                        <strong>Calories:</strong> ${calories}
                    </div>
                    <div style="margin: 12px 0;">
                        <strong>Protein:</strong> ${protein}
                    </div>
                    
                    <div style="margin: 16px 0; padding: 12px; background: #ffebee; border-radius: 8px; border-left: 4px solid #c62828;">
                        <strong style="color: #c62828;">⚠️ Allergens:</strong>
                        <div style="color: #d32f2f; margin-top: 6px; font-size: 14px;">
                            ${allergenList}
                        </div>
                    </div>
                    
                    <button onclick="this.closest('div').parentElement.remove()" style="
                        margin-top: 16px;
                        width: 100%;
                        padding: 10px;
                        background: #ff4d4d;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#ff6b35'" onmouseout="this.style.background='#ff4d4d'">
                        Close
                    </button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Close on outside click
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.remove();
            });
        });
    });

    /* ==========================================
    | EMAIL VERIFICATION - OTP SYSTEM          |
    ========================================== */
    function generateOTP() {
        // Generate a 4-digit random code
        return Math.floor(Math.random() * 9000 + 1000).toString();
    }

    function showOTPModal(userEmail, onVerify) {
        const otp = generateOTP();

        // Store OTP in session storage (expires when tab closes)
        try { sessionStorage.setItem('pending-otp', otp); } catch (e) { console.error(e); }

        // Create OTP input modal (demo displays code inside modal instead of console/alert)
        const modal = document.createElement('div');
        modal.id = 'otp-modal';
        modal.innerHTML = `
            <div class="otp-modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:20000;">
                <div style="background:white; padding:28px; border-radius:12px; max-width:420px; box-shadow:0 14px 40px rgba(0,0,0,0.25); font-family:Arial,sans-serif;">
                    <h2 style="margin:0 0 12px 0; color:#ff4d4d; text-align:center;">Verify Your Email</h2>
                    <p style="text-align:center; color:#666; margin:0 0 12px 0;">A 4-digit code was sent to <strong>${userEmail}</strong>.</p>

                    <div style="background:#fff8f0; padding:8px 12px; border-radius:8px; border:1px dashed #ffd3b3; text-align:center; margin-bottom:12px; color:#b24a2a; font-weight:700;">
                        Demo OTP (visible for testing): <span id="demo-otp" style="letter-spacing:3px;">${otp}</span>
                    </div>

                    <input type="text" id="otp-input" maxlength="4" placeholder="Enter code" style="width:100%; padding:12px; font-size:20px; text-align:center; border:2px solid #eee; border-radius:8px; margin:6px 0; font-weight:700;">
                    <div id="otp-error" style="color:#d32f2f; font-size:12px; margin:8px 0; display:none;"></div>
                    <div style="display:flex; gap:12px; margin-top:18px;">
                        <button id="otp-cancel" style="flex:1; padding:10px; background:#f2f2f2; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Cancel</button>
                        <button id="otp-submit" style="flex:1; padding:10px; background:#ff4d4d; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Verify</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const otpInput = document.getElementById('otp-input');
        const otpError = document.getElementById('otp-error');
        const cancelBtn = document.getElementById('otp-cancel');
        const submitBtn = document.getElementById('otp-submit');

        // Focus input
        otpInput.focus();

        // Submit handler
        submitBtn.addEventListener('click', () => {
            const enteredOTP = otpInput.value.trim();
            if (enteredOTP === otp) {
                modal.remove();
                onVerify(true);
            } else {
                otpError.textContent = 'Invalid code. Please try again.';
                otpError.style.display = 'block';
                otpInput.value = '';
                otpInput.focus();
            }
        });

        // Allow Enter key to verify
        otpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitBtn.click();
        });

        // Cancel handler
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            onVerify(false);
        });

        // Close on overlay click
        modal.querySelector('.otp-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'otp-modal' || e.target.classList.contains('otp-modal-overlay')) {
                modal.remove();
                onVerify(false);
            }
        });
    }

    /* ==========================================
    | AUTH: Signup / Login form handlers        |
    ========================================== */
    // Update auth-area in header to show logged-in user or login/signup links
    (function renderAuthArea() {
        const authArea = document.getElementById('auth-area');
        if (!authArea) return;
        const user = getLoggedInUser();
        if (user && user.email) {
            authArea.innerHTML = `
                <span class="account-email" style="cursor:pointer; color:#ff4d4d; font-weight:bold;">${user.email}</span>
                <button id="logout-btn" class="account-link" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-weight:bold; text-decoration:underline;">Logout</button>
            `;
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('foodhub-current-user');
                window.location.reload();
            });

            // Make email clickable to go to dashboard
            const emailSpan = authArea.querySelector('.account-email');
            if (emailSpan) {
                emailSpan.addEventListener('click', () => {
                    window.location.href = 'account.html';
                });
            }
        }
    })();

    // Hide auth-area when cart is open
    if (myCartSidebar && document.getElementById('auth-area')) {
        const authArea = document.getElementById('auth-area');
        const authObserver = new MutationObserver(() => {
            if (myCartSidebar.classList.contains('active')) {
                authArea.style.display = 'none';
            } else {
                authArea.style.display = 'flex';
            }
        });
        authObserver.observe(myCartSidebar, { attributes: true, attributeFilter: ['class'] });
    }

    // Signup handler (on signup.html)
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputs = signupForm.querySelectorAll('input');
            const fullName = inputs[0]?.value?.trim();
            const email = inputs[1]?.value?.trim();
            const password = inputs[2]?.value || '';
            const confirm = inputs[3]?.value || '';

            if (!email || !password) { alert('Please enter email and password'); return; }
            if (password !== confirm) { alert('Passwords do not match'); return; }
            if (findUserByEmail(email)) { alert('An account with this email already exists'); return; }

            // Show OTP verification modal
            showOTPModal(email, (verified) => {
                if (verified) {
                    const user = { email: email, password: password, points: 0, orders: [], createdAt: new Date().toISOString() };
                    saveUser(user);
                    
                    // Auto-login and redirect
                    try { localStorage.setItem('foodhub-current-user', JSON.stringify(user)); } catch (err) { console.error(err); }
                    alert(`✅ Account created successfully! Welcome to FoodHub.`);
                    window.location.href = 'index.html';
                }
            });
        });
    }

    // Login handler (on login.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputs = loginForm.querySelectorAll('input');
            const email = inputs[0]?.value?.trim();
            const password = inputs[1]?.value || '';

            const user = findUserByEmail(email);
            if (!user || user.password !== password) {
                alert('Invalid email or password');
                return;
            }

            // Show OTP verification modal
            showOTPModal(email, (verified) => {
                if (verified) {
                    // Set current user and redirect
                    try { localStorage.setItem('foodhub-current-user', JSON.stringify(user)); } catch (err) { console.error(err); }
                    alert(`✅ Welcome back, ${user.email}!`);
                    window.location.href = 'index.html';
                }
            });
        });
    }

    /* ==========================================
    | NUTRITION MODAL - CLOSE ON OUTSIDE CLICK  |
    ========================================== */
    const nutritionModal = document.getElementById("nutrition-modal");
    if (nutritionModal) {
        nutritionModal.addEventListener("click", (e) => {
            if (e.target === nutritionModal) {
                nutritionModal.classList.remove("active");
            }
        });
    }
  } catch (err) {
    console.error('Initialization error in script.js:', err);
  }
});

