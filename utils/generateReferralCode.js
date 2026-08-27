// Function to generate a random 6-character referral code
export function generateReferralCode() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const characters = letters + numbers;

    let result = '';

    // Ensure at least one letter and one number
    result += letters[Math.floor(Math.random() * letters.length)];
    result += numbers[Math.floor(Math.random() * numbers.length)];

    // Generate remaining 4 characters 
    for (let i = 2; i < 6; i++) {
        result += characters[Math.floor(Math.random() * characters.length)];
    }

    // Shuffle the string to random positions
    return result.split('').sort(() => Math.random() - 0.5).join('');
}