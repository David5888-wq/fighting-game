// Вспомогательные функции для подсчёта комбинаций Ятцы

const COMBINATIONS = [
    { name: "Единицы", key: "ones" },
    { name: "Двойки", key: "twos" },
    { name: "Тройки", key: "threes" },
    { name: "Четвёрки", key: "fours" },
    { name: "Пятёрки", key: "fives" },
    { name: "Шестёрки", key: "sixes" },
    { name: "Три одинаковых", key: "three" },
    { name: "Четыре одинаковых", key: "four" },
    { name: "Фул-хаус", key: "fullhouse" },
    { name: "Малый стрит", key: "small" },
    { name: "Большой стрит", key: "large" },
    { name: "Ятцы", key: "yatzy" },
    { name: "Шанс", key: "chance" }
];

function countDice(dice) {
    const counts = [0,0,0,0,0,0];
    dice.forEach(d => counts[d-1]++);
    return counts;
}

function getScore(key, dice) {
    const counts = countDice(dice);
    switch(key) {
        case "ones": return counts[0] * 1;
        case "twos": return counts[1] * 2;
        case "threes": return counts[2] * 3;
        case "fours": return counts[3] * 4;
        case "fives": return counts[4] * 5;
        case "sixes": return counts[5] * 6;
        case "three": return counts.some(c => c >= 3) ? dice.reduce((a,b) => a+b,0) : 0;
        case "four": return counts.some(c => c >= 4) ? dice.reduce((a,b) => a+b,0) : 0;
        case "fullhouse":
            return (counts.includes(3) && counts.includes(2)) ? 25 : 0;
        case "small":
            return ([1,1,1,1].every((_,i) => counts.slice(i,i+4).every(c=>c>0))) ? 30 : 0;
        case "large":
            return ([1,1,1,1,1].every((_,i) => counts.slice(i,i+5).every(c=>c>0))) ? 40 : 0;
        case "yatzy": return counts.some(c => c === 5) ? 50 : 0;
        case "chance": return dice.reduce((a,b) => a+b,0);
        default: return 0;
    }
}