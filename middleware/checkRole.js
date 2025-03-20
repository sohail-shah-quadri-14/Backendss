export const checkRole = (allowdRoles) => (req, res, next) => {
    if (!allowdRoles.includes(req.user.Role)) {
        return res.status(403).json({ message: `Forbidden,you are not ${allowdRoles} to access this route` });
    }
    next();
};

