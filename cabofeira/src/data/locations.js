// Cape Verde islands and their main cities/towns
export const islands = [
  {
    name: "Santiago",
    cities: ["Praia", "Assomada", "Tarrafal", "Santa Catarina", "São Domingos", "Calheta de São Miguel"],
  },
  {
    name: "São Vicente",
    cities: ["Mindelo", "São Pedro", "Calhau", "Baía das Gatas"],
  },
  {
    name: "Santo Antão",
    cities: ["Ponta do Sol", "Ribeira Grande", "Porto Novo", "Paúl"],
  },
  {
    name: "Fogo",
    cities: ["São Filipe", "Mosteiros", "Chã das Caldeiras"],
  },
  {
    name: "Sal",
    cities: ["Espargos", "Santa Maria", "Palmeira", "Pedra de Lume"],
  },
  {
    name: "Boa Vista",
    cities: ["Sal Rei", "Rabil", "João Galego"],
  },
  {
    name: "Maio",
    cities: ["Vila do Maio", "Calheta", "Morro"],
  },
  {
    name: "São Nicolau",
    cities: ["Ribeira Brava", "Tarrafal de São Nicolau", "Preguiça"],
  },
  {
    name: "Brava",
    cities: ["Nova Sintra", "Furna", "Fajã d'Água"],
  },
];

export const allCities = islands.flatMap((i) =>
  i.cities.map((c) => ({ city: c, island: i.name }))
);
