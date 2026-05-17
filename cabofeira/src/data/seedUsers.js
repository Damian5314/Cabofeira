// Seed accounts that always exist. Login validates against these first.
// The "user" role is a normal seller/buyer; "admin" can access the admin panel.
export const seedUsers = [
  {
    id: "u_admin",
    name: "Admin",
    email: "admin@cabofeira.cv",
    password: "admin123",
    phone: "+238 999 0001",
    role: "admin",
    memberSince: "2023-01-01",
    verified: true,
    bio: "Platform administrator.",
  },
  {
    id: "u_demo",
    name: "Maria Demo",
    email: "user@cabofeira.cv",
    password: "user123",
    phone: "+238 991 1234",
    role: "user",
    memberSince: "2024-06-15",
    verified: false,
    bio: "Demo account — try posting an ad!",
  },
];

export const findSeedUser = (email) =>
  seedUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

// Strip the password before exposing a seed user as the logged-in user.
export const publicUser = (u) => {
  const { password, ...rest } = u;
  return rest;
};
