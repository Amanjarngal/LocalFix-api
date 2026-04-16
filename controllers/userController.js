import { User } from "../models/userSchema.js";
import { genToken } from "../utils/authToken.js";
import { comparePassword, hashedPassword } from "../utils/hashedPass.js";

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    console.log(req.body);
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required!",
      });
    }

    const isUser = await User.findOne({ email });
    if (isUser) {
      return res.status(403).json({
        message: "User already exists!",
      });
    }

    const hashed = await hashedPassword(password);
    const user = await User.create({
      name,
      email,
      password: hashed,
    });

    const token = await genToken(user._id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000 * 2,
    });

    return res.status(201).json({
      message: "User created successfully",
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        addresses: user.addresses,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};

export const logoutUser = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: false, // Set to true in production
      sameSite: "lax",
    });
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "All fields are required!",
      });
    }

    const isUserExists = await User.findOne({ email });
    if (!isUserExists) {
      return res.status(404).json({
        message: "User does not exists!",
      });
    }

    const isPasswordCorrect = await comparePassword(
      password,
      isUserExists.password,
    );

    if (isPasswordCorrect) {
      const token = await genToken(isUserExists._id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000 * 2,
      });
      return res.status(200).json({
        message: "Login successfull",
        success: true,
        data: {
          _id: isUserExists._id,
          name: isUserExists.name,
          role: isUserExists.role,
          email: isUserExists.email,
          addresses: isUserExists.addresses,
          isPasswordResetRequired: isUserExists.isPasswordResetRequired,
        },
      });
    } else {
      return res.status(403).json({
        message: "Invalid credentials",
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};

export const assignAdminRole = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { role: "admin" },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: `User ${email} promoted to admin successfully`,
      success: true,
      data: user,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};
export const updatePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    const hashed = await hashedPassword(newPassword);
    await User.findByIdAndUpdate(userId, {
      password: hashed,
      isPasswordResetRequired: false,
    });

    return res.status(200).json({
      message: "Password updated successfully",
      success: true,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      data: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const addAddress = async (req, res) => {
  try {
    const { line1, area, city, pincode, contactName, contactNumber, isDefault } = req.body;

    if (!line1 || !area || !city || !pincode || !contactName || !contactNumber) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // If this is the first address, make it default
    const isFirstAddress = user.addresses.length === 0;
    const addressData = {
      line1,
      area,
      city,
      pincode,
      contactName,
      contactNumber,
      isDefault: isDefault || isFirstAddress,
    };

    // If new address is set to default, unset others
    if (addressData.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push(addressData);
    await user.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updates = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });

    // If setting this one to default, unset others
    if (updates.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    Object.assign(address, updates);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const addressToDelete = user.addresses.id(addressId);
    if (!addressToDelete) return res.status(404).json({ success: false, message: "Address not found" });

    const wasDefault = addressToDelete.isDefault;
    user.addresses.pull(addressId);

    // If we deleted the default address, make the first remaining one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
