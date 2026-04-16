import { Cart } from "../models/cartSchema.js";
import { Problem } from "../models/serviceSchema.js";

// Add item to cart
export const addToCart = async (req, res) => {
    try {
        const { userId, problemId, serviceName } = req.body;

        // Find the problem to get its price
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        let cart = await Cart.findOne({ userId });

        if (cart) {
            // Check if item exists in cart
            const itemIndex = cart.items.findIndex((item) => item.problemId.toString() === problemId);

            if (itemIndex > -1) {
                // Item exists, verify user choice. 
                // User requested "no + button", so maybe we just ensure it's in the cart (idempotent)
                // or effectively "quantity = 1" always if logical.
                // But for a robust backend, I'll just increment. The frontend can restrict calls.
                cart.items[itemIndex].quantity += 1;
            } else {
                // Add new item
                cart.items.push({ problemId, quantity: 1, serviceName });
            }
        } else {
            // Create new cart
            cart = await Cart.create({
                userId,
                items: [{ problemId, quantity: 1, serviceName }],
            });
        }

        // Recalculate total price
        // We need to fetch all problems to calculate exact price if we don't store price in item.
        // For simplicity, let's fetch details.
        // Actually, populating is better but detailed calc is safer.

        // Efficient way:
        // 1. Get all problem IDs
        // 2. Fetch prices
        // 3. Sum up

        // Or just iterate since we have the problem object for the *added* item, but not others?
        // Let's do a full recalculation to be safe.
        await cart.populate('items.problemId');

        cart.totalPrice = cart.items.reduce((total, item) => {
            return total + (item.problemId.price * item.quantity);
        }, 0);

        // Depopulate before saving? No, mongoose handles it if we save the doc. 
        // Wait, if we populated 'problemId', items.problemId is now an object.
        // Saving might try to save the whole object depending on Mongoose version/config.
        // Safer to re-fetch or calc manually.

        // Let's just use the current push and a simpler calc if possible, 
        // but correct price syncing is important.

        // Alternative: Just save, then findById and populate to return to frontend.
        // We need to save the total price though.

        // Let's try this:
        // Reset to ID-only for calculation if needed, or helper?

        // Simpler approach:
        // Save first (with ids). Then aggregate.
        // Actually, let's just loop and fetch prices.

        // Re-Reading cart to populate
        // To safe-guard, let's just save the modifications first (without total update?), 
        // NO, total needs to be correct.

        // Let's calculate total based on what we have.
        // We only have the `problem` price for the current item.
        // We don't know other items' prices without fetching.

        // Strategy:
        // 1. Save the cart items.
        // 2. Find the cart again, populate 'items.problemId'.
        // 3. Calculate total.
        // 4. Save again.

        // Actually, `cart` is a mongoose document.
        // If we simply `await cart.save()`, it saves `items`.

        // Let's save the items first.
        await cart.save();

        // Now calc total
        const populatedCart = await Cart.findOne({ userId }).populate('items.problemId');

        const total = populatedCart.items.reduce((sum, item) => {
            return sum + (item.problemId ? item.problemId.price * item.quantity : 0);
        }, 0);

        populatedCart.totalPrice = total;
        await populatedCart.save();

        res.status(200).json({ message: "Item added to cart", cart: populatedCart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// Get user cart
export const getCart = async (req, res) => {
    try {
        const { userId } = req.params;
        const cart = await Cart.findOne({ userId }).populate("items.problemId");

        if (!cart) {
            return res.status(200).json({ message: "Cart empty", cart: { items: [], totalPrice: 0 } });
        }

        // Filter out null problemIds (if a problem was deleted)
        const validItems = cart.items.filter(item => item.problemId != null);
        if (validItems.length !== cart.items.length) {
            cart.items = validItems;
            // Recalc total
            cart.totalPrice = validItems.reduce((sum, item) => sum + (item.problemId.price * item.quantity), 0);
            await cart.save();
        }

        res.status(200).json({ cart });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
    try {
        const { userId, itemId } = req.body; // itemId is the _id of the item in the array, OR problemId? standard is usually product id or item id.
        // Let's assume problemId for simplicity in "remove from cart" buttons that know the product.
        // Or better, let's use problemId.

        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        // Filter out the item
        cart.items = cart.items.filter(item => item.problemId.toString() !== itemId);

        await cart.save();

        // Recalc total
        const populatedCart = await Cart.findOne({ userId }).populate('items.problemId');
        const total = populatedCart.items.reduce((sum, item) => {
            return sum + (item.problemId ? item.problemId.price * item.quantity : 0);
        }, 0);

        populatedCart.totalPrice = total;
        await populatedCart.save();

        res.status(200).json({ message: "Item removed", cart: populatedCart });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// Clear entire cart
export const clearCart = async (req, res) => {
    try {
        // userId should ideally come from req.user.id if using auth middleware
        // For now, checking if it's passed in body or using req.user.id if available
        const userId = req.user ? req.user.id : req.body.userId;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const cart = await Cart.findOne({ userId });
        if (cart) {
            cart.items = [];
            cart.totalPrice = 0;
            await cart.save();
        }

        res.status(200).json({ success: true, message: "Cart cleared" });
    } catch (error) {
        console.error("Clear Cart Error:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
