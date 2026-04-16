import bcrypt from "bcrypt";

export const hashedPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    return hashed;
  } catch (err) {
    console.log("unable to hash password");
  }
};

export const comparePassword = async (password, hashedPass) => {
  return await bcrypt.compare(password, hashedPass);
};
