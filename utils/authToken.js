import jwt from "jsonwebtoken";

export const genToken = async (id) => {
  return await jwt.sign({ id: id }, process.env.JWT_SECRET_KEY, {
    expiresIn: "2d",
  });
};
