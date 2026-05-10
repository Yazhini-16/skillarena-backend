require('dotenv').config();
const { pool } = require('../config/db');

const problems = [
  // ─── EASY: ARRAYS ──────────────────────────────────────────────
  {
    title: 'Sum of Array',
    slug: 'sum-of-array',
    description: 'Find the sum of all elements.\n\nInput: First line is N. Second line is N space-separated integers.\nOutput: Single integer.\n\nExample:\nInput:\n5\n1 2 3 4 5\nOutput:\n15',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '5\n1 2 3 4 5', expected_output: '15', is_public: true, weight: 1 },
      { input: '3\n10 20 30', expected_output: '60', is_public: true, weight: 1 },
      { input: '1\n42', expected_output: '42', is_public: false, weight: 1 },
      { input: '4\n-1 -2 3 4', expected_output: '4', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Find Maximum',
    slug: 'find-maximum',
    description: 'Find the maximum element.\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n5\n3 1 4 1 5\nOutput:\n5',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '5\n3 1 4 1 5', expected_output: '5', is_public: true, weight: 1 },
      { input: '3\n10 20 30', expected_output: '30', is_public: true, weight: 1 },
      { input: '4\n-5 -1 -3 -2', expected_output: '-1', is_public: false, weight: 1 },
      { input: '1\n7', expected_output: '7', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Find Minimum',
    slug: 'find-minimum',
    description: 'Find the minimum element.\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n5\n3 1 4 1 5\nOutput:\n1',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '5\n3 1 4 1 5', expected_output: '1', is_public: true, weight: 1 },
      { input: '3\n10 20 30', expected_output: '10', is_public: true, weight: 1 },
      { input: '4\n-5 -1 -3 -2', expected_output: '-5', is_public: false, weight: 1 },
      { input: '1\n7', expected_output: '7', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Count Even Numbers',
    slug: 'count-even',
    description: 'Count even numbers in an array.\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n5\n1 2 3 4 5\nOutput:\n2',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '5\n1 2 3 4 5', expected_output: '2', is_public: true, weight: 1 },
      { input: '4\n2 4 6 8', expected_output: '4', is_public: true, weight: 1 },
      { input: '3\n1 3 5', expected_output: '0', is_public: false, weight: 1 },
      { input: '6\n10 11 12 13 14 15', expected_output: '3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Reverse Array',
    slug: 'reverse-array',
    description: 'Print array in reverse order.\n\nInput: First line is N. Second line is N integers.\nOutput: Space-separated reversed array.\n\nExample:\nInput:\n4\n1 2 3 4\nOutput:\n4 3 2 1',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '4\n1 2 3 4', expected_output: '4 3 2 1', is_public: true, weight: 1 },
      { input: '3\n5 10 15', expected_output: '15 10 5', is_public: true, weight: 1 },
      { input: '1\n7', expected_output: '7', is_public: false, weight: 1 },
      { input: '5\n9 8 7 6 5', expected_output: '5 6 7 8 9', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Array Average',
    slug: 'array-average',
    description: 'Find average (floor) of all elements.\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer (floor of average).\n\nExample:\nInput:\n4\n1 2 3 4\nOutput:\n2',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '4\n1 2 3 4', expected_output: '2', is_public: true, weight: 1 },
      { input: '3\n10 20 30', expected_output: '20', is_public: true, weight: 1 },
      { input: '5\n1 1 1 1 1', expected_output: '1', is_public: false, weight: 1 },
      { input: '2\n7 8', expected_output: '7', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Move Zeros',
    slug: 'move-zeros',
    description: 'Move all zeros to end maintaining order of non-zeros.\n\nInput: First line is N. Second line is N integers.\nOutput: Rearranged array.\n\nExample:\nInput:\n5\n0 1 0 3 12\nOutput:\n1 3 12 0 0',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '5\n0 1 0 3 12', expected_output: '1 3 12 0 0', is_public: true, weight: 1 },
      { input: '3\n0 0 1', expected_output: '1 0 0', is_public: true, weight: 1 },
      { input: '4\n1 2 3 4', expected_output: '1 2 3 4', is_public: false, weight: 1 },
      { input: '4\n0 0 0 0', expected_output: '0 0 0 0', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Sort Array Ascending',
    slug: 'sort-array',
    description: 'Sort array in ascending order.\n\nInput: First line is N. Second line is N integers.\nOutput: Sorted array.\n\nExample:\nInput:\n5\n3 1 4 1 5\nOutput:\n1 1 3 4 5',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '5\n3 1 4 1 5', expected_output: '1 1 3 4 5', is_public: true, weight: 1 },
      { input: '4\n4 3 2 1', expected_output: '1 2 3 4', is_public: true, weight: 1 },
      { input: '3\n5 5 5', expected_output: '5 5 5', is_public: false, weight: 1 },
      { input: '6\n-3 0 2 -1 5 1', expected_output: '-3 -1 0 1 2 5', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Frequency Count',
    slug: 'frequency-count',
    description: 'Find most frequent element. If tie, print smaller one.\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n6\n1 2 2 3 3 3\nOutput:\n3',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '6\n1 2 2 3 3 3', expected_output: '3', is_public: true, weight: 1 },
      { input: '5\n1 1 2 2 3', expected_output: '1', is_public: true, weight: 1 },
      { input: '3\n5 5 5', expected_output: '5', is_public: false, weight: 1 },
      { input: '4\n1 2 3 4', expected_output: '1', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Prefix Sum',
    slug: 'prefix-sum',
    description: 'Given array and Q range queries [l,r], find sum of elements from index l to r (0-based).\n\nInput: First line is N. Second line is N integers. Third line is Q. Next Q lines are l r pairs.\nOutput: Q lines, each with sum.\n\nExample:\nInput:\n5\n1 2 3 4 5\n2\n0 2\n1 3\nOutput:\n6\n9',
    difficulty: 'easy', category: 'arrays',
    test_cases: [
      { input: '5\n1 2 3 4 5\n2\n0 2\n1 3', expected_output: '6\n9', is_public: true, weight: 1 },
      { input: '3\n1 1 1\n1\n0 2', expected_output: '3', is_public: true, weight: 1 },
      { input: '4\n2 4 6 8\n2\n0 0\n2 3', expected_output: '2\n14', is_public: false, weight: 2 },
    ],
  },

  // ─── EASY: STRINGS ─────────────────────────────────────────────
  {
    title: 'Count Vowels',
    slug: 'count-vowels',
    description: 'Count vowels (a,e,i,o,u) in a string.\n\nInput: Single lowercase string.\nOutput: Single integer.\n\nExample:\nInput:\nhello\nOutput:\n2',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello', expected_output: '2', is_public: true, weight: 1 },
      { input: 'aeiou', expected_output: '5', is_public: true, weight: 1 },
      { input: 'rhythm', expected_output: '0', is_public: false, weight: 1 },
      { input: 'programming', expected_output: '3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Reverse String',
    slug: 'reverse-string',
    description: 'Reverse a string.\n\nInput: Single string.\nOutput: Reversed string.\n\nExample:\nInput:\nhello\nOutput:\nolleh',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello', expected_output: 'olleh', is_public: true, weight: 1 },
      { input: 'abcde', expected_output: 'edcba', is_public: true, weight: 1 },
      { input: 'a', expected_output: 'a', is_public: false, weight: 1 },
      { input: 'racecar', expected_output: 'racecar', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Palindrome Check',
    slug: 'palindrome-check',
    description: 'Check if a string is a palindrome.\n\nInput: Single lowercase string.\nOutput: true or false\n\nExample:\nInput:\nracecar\nOutput:\ntrue',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'racecar', expected_output: 'true', is_public: true, weight: 1 },
      { input: 'hello', expected_output: 'false', is_public: true, weight: 1 },
      { input: 'a', expected_output: 'true', is_public: false, weight: 1 },
      { input: 'abcba', expected_output: 'true', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Reverse Words',
    slug: 'reverse-words',
    description: 'Reverse the order of words.\n\nInput: Single line string.\nOutput: Words in reverse order.\n\nExample:\nInput:\nhello world\nOutput:\nworld hello',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello world', expected_output: 'world hello', is_public: true, weight: 1 },
      { input: 'the sky is blue', expected_output: 'blue is sky the', is_public: true, weight: 1 },
      { input: 'one', expected_output: 'one', is_public: false, weight: 1 },
      { input: 'a good example', expected_output: 'example good a', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Count Words',
    slug: 'count-words',
    description: 'Count words in a string.\n\nInput: Single line string.\nOutput: Single integer.\n\nExample:\nInput:\nhello world foo\nOutput:\n3',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello world foo', expected_output: '3', is_public: true, weight: 1 },
      { input: 'one', expected_output: '1', is_public: true, weight: 1 },
      { input: 'a b c d e', expected_output: '5', is_public: false, weight: 1 },
      { input: 'hello world', expected_output: '2', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Caesar Cipher',
    slug: 'caesar-cipher',
    description: 'Encrypt lowercase string with Caesar cipher shift K.\n\nInput: First line is string. Second line is K.\nOutput: Encrypted string.\n\nExample:\nInput:\nhello\n3\nOutput:\nkhoor',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello\n3', expected_output: 'khoor', is_public: true, weight: 1 },
      { input: 'abc\n1', expected_output: 'bcd', is_public: true, weight: 1 },
      { input: 'xyz\n3', expected_output: 'abc', is_public: false, weight: 1 },
      { input: 'hello\n26', expected_output: 'hello', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Remove Duplicate Characters',
    slug: 'remove-dup-chars',
    description: 'Remove duplicate characters keeping first occurrence.\n\nInput: Single lowercase string.\nOutput: String with duplicates removed.\n\nExample:\nInput:\nbanana\nOutput:\nban',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'banana', expected_output: 'ban', is_public: true, weight: 1 },
      { input: 'hello', expected_output: 'helo', is_public: true, weight: 1 },
      { input: 'abc', expected_output: 'abc', is_public: false, weight: 1 },
      { input: 'aabbcc', expected_output: 'abc', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Count Character Occurrences',
    slug: 'count-char',
    description: 'Count occurrences of a character in a string.\n\nInput: First line is string. Second line is character.\nOutput: Single integer.\n\nExample:\nInput:\nhello\nl\nOutput:\n2',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello\nl', expected_output: '2', is_public: true, weight: 1 },
      { input: 'banana\na', expected_output: '3', is_public: true, weight: 1 },
      { input: 'xyz\nq', expected_output: '0', is_public: false, weight: 1 },
      { input: 'aaaaaa\na', expected_output: '6', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'String to Uppercase',
    slug: 'string-uppercase',
    description: 'Convert string to uppercase.\n\nInput: Single string.\nOutput: Uppercase string.\n\nExample:\nInput:\nhello\nOutput:\nHELLO',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello', expected_output: 'HELLO', is_public: true, weight: 1 },
      { input: 'world', expected_output: 'WORLD', is_public: true, weight: 1 },
      { input: 'abc123', expected_output: 'ABC123', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Check Substring',
    slug: 'check-substring',
    description: 'Check if pattern exists in text.\n\nInput: First line is text. Second line is pattern.\nOutput: true or false\n\nExample:\nInput:\nhello world\nworld\nOutput:\ntrue',
    difficulty: 'easy', category: 'strings',
    test_cases: [
      { input: 'hello world\nworld', expected_output: 'true', is_public: true, weight: 1 },
      { input: 'hello world\nxyz', expected_output: 'false', is_public: true, weight: 1 },
      { input: 'abcdef\ncde', expected_output: 'true', is_public: false, weight: 2 },
    ],
  },

  // ─── EASY: MATH ────────────────────────────────────────────────
  {
    title: 'Prime Check',
    slug: 'prime-check',
    description: 'Check if N is prime.\n\nInput: Single integer N.\nOutput: true or false\n\nExample:\nInput:\n7\nOutput:\ntrue',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '7', expected_output: 'true', is_public: true, weight: 1 },
      { input: '4', expected_output: 'false', is_public: true, weight: 1 },
      { input: '1', expected_output: 'false', is_public: false, weight: 1 },
      { input: '2', expected_output: 'true', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Factorial',
    slug: 'factorial',
    description: 'Find factorial of N (0<=N<=12).\n\nInput: Single integer N.\nOutput: Single integer.\n\nExample:\nInput:\n5\nOutput:\n120',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '5', expected_output: '120', is_public: true, weight: 1 },
      { input: '0', expected_output: '1', is_public: true, weight: 1 },
      { input: '1', expected_output: '1', is_public: false, weight: 1 },
      { input: '10', expected_output: '3628800', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'FizzBuzz',
    slug: 'fizzbuzz',
    description: 'Print 1 to N. Multiples of 3 → Fizz, 5 → Buzz, both → FizzBuzz.\n\nInput: Single integer N.\nOutput: N lines.\n\nExample:\nInput:\n5\nOutput:\n1\n2\nFizz\n4\nBuzz',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '5', expected_output: '1\n2\nFizz\n4\nBuzz', is_public: true, weight: 1 },
      { input: '15', expected_output: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', is_public: true, weight: 1 },
      { input: '1', expected_output: '1', is_public: false, weight: 1 },
      { input: '3', expected_output: '1\n2\nFizz', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Power of Two',
    slug: 'power-of-two',
    description: 'Check if N is a power of 2.\n\nInput: Single integer N.\nOutput: true or false\n\nExample:\nInput:\n16\nOutput:\ntrue',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '16', expected_output: 'true', is_public: true, weight: 1 },
      { input: '18', expected_output: 'false', is_public: true, weight: 1 },
      { input: '1', expected_output: 'true', is_public: false, weight: 1 },
      { input: '0', expected_output: 'false', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'GCD',
    slug: 'gcd',
    description: 'Find GCD of two numbers.\n\nInput: Two space-separated integers.\nOutput: Single integer.\n\nExample:\nInput:\n12 8\nOutput:\n4',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '12 8', expected_output: '4', is_public: true, weight: 1 },
      { input: '100 75', expected_output: '25', is_public: true, weight: 1 },
      { input: '7 3', expected_output: '1', is_public: false, weight: 1 },
      { input: '0 5', expected_output: '5', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Fibonacci Nth Term',
    slug: 'fibonacci-nth',
    description: 'Find Nth Fibonacci number (0-indexed). F(0)=0, F(1)=1.\n\nInput: Single integer N.\nOutput: Single integer.\n\nExample:\nInput:\n6\nOutput:\n8',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '6', expected_output: '8', is_public: true, weight: 1 },
      { input: '0', expected_output: '0', is_public: true, weight: 1 },
      { input: '1', expected_output: '1', is_public: false, weight: 1 },
      { input: '10', expected_output: '55', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Sum of Digits',
    slug: 'sum-of-digits',
    description: 'Find sum of digits of a number.\n\nInput: Single non-negative integer.\nOutput: Single integer.\n\nExample:\nInput:\n123\nOutput:\n6',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '123', expected_output: '6', is_public: true, weight: 1 },
      { input: '999', expected_output: '27', is_public: true, weight: 1 },
      { input: '0', expected_output: '0', is_public: false, weight: 1 },
      { input: '10000', expected_output: '1', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Armstrong Number',
    slug: 'armstrong-number',
    description: 'Check if a number is an Armstrong number (sum of its digits each raised to the power of number of digits equals the number).\n\nInput: Single positive integer.\nOutput: true or false\n\nExample:\nInput:\n153\nOutput:\ntrue',
    difficulty: 'easy', category: 'math',
    test_cases: [
      { input: '153', expected_output: 'true', is_public: true, weight: 1 },
      { input: '123', expected_output: 'false', is_public: true, weight: 1 },
      { input: '371', expected_output: 'true', is_public: false, weight: 1 },
      { input: '9474', expected_output: 'true', is_public: false, weight: 2 },
    ],
  },

  // ─── MEDIUM: ARRAYS ────────────────────────────────────────────
  {
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Return indices of two numbers that add up to target.\n\nInput: First line is space-separated integers. Second line is target.\nOutput: Two space-separated indices (0-based).\n\nExample:\nInput:\n2 7 11 15\n9\nOutput:\n0 1',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '2 7 11 15\n9', expected_output: '0 1', is_public: true, weight: 1 },
      { input: '3 2 4\n6', expected_output: '1 2', is_public: true, weight: 1 },
      { input: '3 3\n6', expected_output: '0 1', is_public: false, weight: 1 },
      { input: '1 2 3 4 5\n9', expected_output: '3 4', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Missing Number',
    slug: 'missing-number',
    description: 'Find missing number in array of 1 to N.\n\nInput: First line is N. Second line is N-1 integers.\nOutput: Missing number.\n\nExample:\nInput:\n5\n1 2 4 5\nOutput:\n3',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '5\n1 2 4 5', expected_output: '3', is_public: true, weight: 1 },
      { input: '3\n1 3', expected_output: '2', is_public: true, weight: 1 },
      { input: '2\n1', expected_output: '2', is_public: false, weight: 1 },
      { input: '6\n1 2 3 4 6', expected_output: '5', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Second Largest',
    slug: 'second-largest',
    description: 'Find second largest distinct element. Print -1 if impossible.\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n5\n3 1 4 1 5\nOutput:\n4',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '5\n3 1 4 1 5', expected_output: '4', is_public: true, weight: 1 },
      { input: '4\n10 20 30 40', expected_output: '30', is_public: true, weight: 1 },
      { input: '3\n5 5 5', expected_output: '-1', is_public: false, weight: 1 },
      { input: '6\n1 2 3 4 5 6', expected_output: '5', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Rotate Array',
    slug: 'rotate-array',
    description: 'Rotate array right by K positions.\n\nInput: First line is N and K. Second line is N integers.\nOutput: Rotated array.\n\nExample:\nInput:\n5 2\n1 2 3 4 5\nOutput:\n4 5 1 2 3',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '5 2\n1 2 3 4 5', expected_output: '4 5 1 2 3', is_public: true, weight: 1 },
      { input: '3 1\n1 2 3', expected_output: '3 1 2', is_public: true, weight: 1 },
      { input: '4 4\n1 2 3 4', expected_output: '1 2 3 4', is_public: false, weight: 1 },
      { input: '5 7\n1 2 3 4 5', expected_output: '4 5 1 2 3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Maximum Subarray Sum',
    slug: 'max-subarray',
    description: 'Find contiguous subarray with largest sum (Kadane\'s).\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n9\n-2 1 -3 4 -1 2 1 -5 4\nOutput:\n6',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '9\n-2 1 -3 4 -1 2 1 -5 4', expected_output: '6', is_public: true, weight: 1 },
      { input: '4\n1 2 3 4', expected_output: '10', is_public: true, weight: 1 },
      { input: '4\n-1 -2 -3 -4', expected_output: '-1', is_public: false, weight: 1 },
      { input: '6\n-2 -3 4 -1 -2 1', expected_output: '4', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Product Except Self',
    slug: 'product-except-self',
    description: 'Return array where each element is product of all others (no division).\n\nInput: First line is N. Second line is N integers.\nOutput: Product array.\n\nExample:\nInput:\n4\n1 2 3 4\nOutput:\n24 12 8 6',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '4\n1 2 3 4', expected_output: '24 12 8 6', is_public: true, weight: 1 },
      { input: '2\n5 2', expected_output: '2 5', is_public: true, weight: 1 },
      { input: '3\n1 0 3', expected_output: '0 3 0', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Array Intersection',
    slug: 'array-intersection',
    description: 'Find common elements between two arrays (unique, sorted). Print -1 if none.\n\nInput: First line is N, second line N integers. Third line is M, fourth line M integers.\nOutput: Sorted unique common elements or -1.\n\nExample:\nInput:\n4\n1 2 3 4\n4\n3 4 5 6\nOutput:\n3 4',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '4\n1 2 3 4\n4\n3 4 5 6', expected_output: '3 4', is_public: true, weight: 1 },
      { input: '3\n1 2 3\n3\n4 5 6', expected_output: '-1', is_public: true, weight: 1 },
      { input: '3\n1 1 2\n3\n1 2 2', expected_output: '1 2', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Merge Sorted Arrays',
    slug: 'merge-sorted-arrays',
    description: 'Merge two sorted arrays into one sorted array.\n\nInput: First line is N, second line N sorted integers. Third line is M, fourth line M sorted integers.\nOutput: Merged sorted array.\n\nExample:\nInput:\n3\n1 3 5\n3\n2 4 6\nOutput:\n1 2 3 4 5 6',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '3\n1 3 5\n3\n2 4 6', expected_output: '1 2 3 4 5 6', is_public: true, weight: 1 },
      { input: '2\n1 2\n2\n3 4', expected_output: '1 2 3 4', is_public: true, weight: 1 },
      { input: '3\n1 1 1\n3\n1 1 1', expected_output: '1 1 1 1 1 1', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Majority Element',
    slug: 'majority-element',
    description: 'Find element appearing more than N/2 times. Guaranteed to exist.\n\nInput: First line is N. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n5\n2 2 1 1 2\nOutput:\n2',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '5\n2 2 1 1 2', expected_output: '2', is_public: true, weight: 1 },
      { input: '3\n3 2 3', expected_output: '3', is_public: true, weight: 1 },
      { input: '7\n1 1 1 2 2 3 1', expected_output: '1', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Subarray Sum Equals K',
    slug: 'subarray-sum-k',
    description: 'Count subarrays whose sum equals K.\n\nInput: First line is N and K. Second line is N integers.\nOutput: Single integer.\n\nExample:\nInput:\n5 2\n1 1 1 2 3\nOutput:\n3',
    difficulty: 'medium', category: 'arrays',
    test_cases: [
      { input: '5 2\n1 1 1 2 3', expected_output: '3', is_public: true, weight: 1 },
      { input: '4 0\n1 -1 0 0', expected_output: '3', is_public: true, weight: 1 },
      { input: '3 3\n1 2 3', expected_output: '2', is_public: false, weight: 2 },
    ],
  },

  // ─── MEDIUM: STRINGS ───────────────────────────────────────────
  {
    title: 'Anagram Check',
    slug: 'anagram-check',
    description: 'Check if two strings are anagrams.\n\nInput: Two lines, each with one string.\nOutput: true or false\n\nExample:\nInput:\nlisten\nsilent\nOutput:\ntrue',
    difficulty: 'medium', category: 'strings',
    test_cases: [
      { input: 'listen\nsilent', expected_output: 'true', is_public: true, weight: 1 },
      { input: 'hello\nworld', expected_output: 'false', is_public: true, weight: 1 },
      { input: 'triangle\nintegral', expected_output: 'true', is_public: false, weight: 1 },
      { input: 'abc\nab', expected_output: 'false', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Longest Unique Substring',
    slug: 'longest-unique-substring',
    description: 'Find length of longest substring without repeating characters.\n\nInput: Single string.\nOutput: Single integer.\n\nExample:\nInput:\nabcabcbb\nOutput:\n3',
    difficulty: 'medium', category: 'strings',
    test_cases: [
      { input: 'abcabcbb', expected_output: '3', is_public: true, weight: 1 },
      { input: 'bbbbb', expected_output: '1', is_public: true, weight: 1 },
      { input: 'pwwkew', expected_output: '3', is_public: false, weight: 1 },
      { input: 'abcdefghij', expected_output: '10', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    description: 'Check if bracket string is valid.\n\nInput: Bracket string.\nOutput: true or false\n\nExample:\nInput:\n()[]{}\nOutput:\ntrue',
    difficulty: 'medium', category: 'strings',
    test_cases: [
      { input: '()', expected_output: 'true', is_public: true, weight: 1 },
      { input: '()[]{}', expected_output: 'true', is_public: true, weight: 1 },
      { input: '(]', expected_output: 'false', is_public: false, weight: 1 },
      { input: '{[]}', expected_output: 'true', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Count Substrings',
    slug: 'count-substrings',
    description: 'Count occurrences of pattern in text.\n\nInput: First line is text. Second line is pattern.\nOutput: Single integer.\n\nExample:\nInput:\nhello world hello\nhello\nOutput:\n2',
    difficulty: 'medium', category: 'strings',
    test_cases: [
      { input: 'hello world hello\nhello', expected_output: '2', is_public: true, weight: 1 },
      { input: 'aaa\naa', expected_output: '2', is_public: true, weight: 1 },
      { input: 'abc\nxyz', expected_output: '0', is_public: false, weight: 1 },
      { input: 'aaaa\na', expected_output: '4', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Longest Common Prefix',
    slug: 'longest-common-prefix',
    description: 'Find longest common prefix among N strings.\n\nInput: First line is N. Next N lines are strings.\nOutput: Longest common prefix (empty string if none).\n\nExample:\nInput:\n3\nflower\nflow\nflight\nOutput:\nfl',
    difficulty: 'medium', category: 'strings',
    test_cases: [
      { input: '3\nflower\nflow\nflight', expected_output: 'fl', is_public: true, weight: 1 },
      { input: '3\ndog\nracecar\ncar', expected_output: '', is_public: true, weight: 1 },
      { input: '2\ninterviewer\ninteractive', expected_output: 'inter', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'String Compression',
    slug: 'string-compression',
    description: 'Compress string using counts of repeated chars. If compressed is not shorter, return original.\n\nInput: Single string.\nOutput: Compressed or original string.\n\nExample:\nInput:\naabcccccaaa\nOutput:\na2b1c5a3',
    difficulty: 'medium', category: 'strings',
    test_cases: [
      { input: 'aabcccccaaa', expected_output: 'a2b1c5a3', is_public: true, weight: 1 },
      { input: 'abc', expected_output: 'abc', is_public: true, weight: 1 },
      { input: 'aabb', expected_output: 'aabb', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Group Anagrams Count',
    slug: 'group-anagrams-count',
    description: 'Given N strings, count number of anagram groups.\n\nInput: First line is N. Next N lines are strings.\nOutput: Number of distinct anagram groups.\n\nExample:\nInput:\n6\neat\ntea\ntan\nate\nnat\nbat\nOutput:\n3',
    difficulty: 'medium', category: 'strings',
    test_cases: [
      { input: '6\neat\ntea\ntan\nate\nnat\nbat', expected_output: '3', is_public: true, weight: 1 },
      { input: '1\na', expected_output: '1', is_public: true, weight: 1 },
      { input: '3\nabc\nbca\ncab', expected_output: '1', is_public: false, weight: 2 },
    ],
  },

  // ─── MEDIUM: DATA STRUCTURES ───────────────────────────────────
  {
    title: 'Stack Operations',
    slug: 'stack-operations',
    description: 'Simulate stack with PUSH X, POP, PEEK.\n\nInput: First line is N. Each line is an operation.\nOutput: Result of POP/PEEK or EMPTY.\n\nExample:\nInput:\n4\nPUSH 5\nPUSH 3\nPEEK\nPOP\nOutput:\n3\n3',
    difficulty: 'medium', category: 'data-structures',
    test_cases: [
      { input: '4\nPUSH 5\nPUSH 3\nPEEK\nPOP', expected_output: '3\n3', is_public: true, weight: 1 },
      { input: '2\nPOP\nPEEK', expected_output: 'EMPTY\nEMPTY', is_public: true, weight: 1 },
      { input: '5\nPUSH 1\nPUSH 2\nPOP\nPOP\nPOP', expected_output: '2\n1\nEMPTY', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Queue using Stacks',
    slug: 'queue-using-stacks',
    description: 'Implement queue using two stacks. ENQUEUE X and DEQUEUE.\n\nInput: First line is N. Each line is an operation.\nOutput: Result of DEQUEUE or EMPTY.\n\nExample:\nInput:\n4\nENQUEUE 1\nENQUEUE 2\nDEQUEUE\nDEQUEUE\nOutput:\n1\n2',
    difficulty: 'medium', category: 'data-structures',
    test_cases: [
      { input: '4\nENQUEUE 1\nENQUEUE 2\nDEQUEUE\nDEQUEUE', expected_output: '1\n2', is_public: true, weight: 1 },
      { input: '2\nDEQUEUE\nDEQUEUE', expected_output: 'EMPTY\nEMPTY', is_public: true, weight: 1 },
      { input: '5\nENQUEUE 5\nENQUEUE 3\nDEQUEUE\nENQUEUE 7\nDEQUEUE', expected_output: '5\n3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Binary Search',
    slug: 'binary-search',
    description: 'Binary search on sorted array.\n\nInput: First line N. Second line sorted integers. Third line target.\nOutput: Index (0-based) or -1.\n\nExample:\nInput:\n5\n1 3 5 7 9\n5\nOutput:\n2',
    difficulty: 'medium', category: 'data-structures',
    test_cases: [
      { input: '5\n1 3 5 7 9\n5', expected_output: '2', is_public: true, weight: 1 },
      { input: '5\n1 3 5 7 9\n6', expected_output: '-1', is_public: true, weight: 1 },
      { input: '1\n5\n5', expected_output: '0', is_public: false, weight: 1 },
      { input: '6\n2 4 6 8 10 12\n10', expected_output: '4', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Hash Map Store',
    slug: 'hashmap-store',
    description: 'Process SET key value and GET key operations.\n\nInput: First line is N. Each line is SET key value or GET key.\nOutput: For each GET, value or NOT FOUND.\n\nExample:\nInput:\n4\nSET a 10\nSET b 20\nGET a\nGET c\nOutput:\n10\nNOT FOUND',
    difficulty: 'medium', category: 'data-structures',
    test_cases: [
      { input: '4\nSET a 10\nSET b 20\nGET a\nGET c', expected_output: '10\nNOT FOUND', is_public: true, weight: 1 },
      { input: '3\nSET x 5\nGET x\nGET y', expected_output: '5\nNOT FOUND', is_public: true, weight: 1 },
      { input: '5\nSET k 1\nSET k 2\nGET k\nSET m 3\nGET m', expected_output: '2\n3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Min Stack',
    slug: 'min-stack',
    description: 'Stack supporting PUSH X, POP, and GETMIN in O(1).\n\nInput: First line is N. Operations: PUSH X, POP, GETMIN.\nOutput: Result of POP/GETMIN or EMPTY.\n\nExample:\nInput:\n5\nPUSH 3\nPUSH 1\nGETMIN\nPOP\nGETMIN\nOutput:\n1\n3',
    difficulty: 'medium', category: 'data-structures',
    test_cases: [
      { input: '5\nPUSH 3\nPUSH 1\nGETMIN\nPOP\nGETMIN', expected_output: '1\n3', is_public: true, weight: 1 },
      { input: '3\nPUSH 5\nGETMIN\nPOP', expected_output: '5', is_public: true, weight: 1 },
      { input: '1\nGETMIN', expected_output: 'EMPTY', is_public: false, weight: 2 },
    ],
  },

  // ─── MEDIUM: ALGORITHMS ────────────────────────────────────────
  {
    title: 'Jump Game',
    slug: 'jump-game',
    description: 'Can you reach the last index from index 0?\n\nInput: First line N. Second line N integers (max jump lengths).\nOutput: true or false\n\nExample:\nInput:\n5\n2 3 1 1 4\nOutput:\ntrue',
    difficulty: 'medium', category: 'algorithms',
    test_cases: [
      { input: '5\n2 3 1 1 4', expected_output: 'true', is_public: true, weight: 1 },
      { input: '5\n3 2 1 0 4', expected_output: 'false', is_public: true, weight: 1 },
      { input: '1\n0', expected_output: 'true', is_public: false, weight: 1 },
      { input: '3\n1 0 0', expected_output: 'false', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Stock Buy Sell',
    slug: 'stock-buy-sell',
    description: 'Max profit from one buy and one sell (buy before sell).\n\nInput: First line N. Second line N prices.\nOutput: Maximum profit (0 if none).\n\nExample:\nInput:\n6\n7 1 5 3 6 4\nOutput:\n5',
    difficulty: 'medium', category: 'algorithms',
    test_cases: [
      { input: '6\n7 1 5 3 6 4', expected_output: '5', is_public: true, weight: 1 },
      { input: '5\n7 6 4 3 1', expected_output: '0', is_public: true, weight: 1 },
      { input: '3\n1 2 3', expected_output: '2', is_public: false, weight: 1 },
      { input: '4\n3 1 4 2', expected_output: '3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Number of Islands',
    slug: 'number-of-islands',
    description: 'Count islands in a grid (1=land, 0=water).\n\nInput: First line R C. Next R lines have C space-separated values.\nOutput: Single integer.\n\nExample:\nInput:\n4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1\nOutput:\n3',
    difficulty: 'medium', category: 'algorithms',
    test_cases: [
      { input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1', expected_output: '3', is_public: true, weight: 1 },
      { input: '2 2\n1 1\n1 1', expected_output: '1', is_public: true, weight: 1 },
      { input: '2 2\n0 0\n0 0', expected_output: '0', is_public: false, weight: 1 },
      { input: '3 3\n1 0 1\n0 1 0\n1 0 1', expected_output: '5', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Bubble Sort Swaps',
    slug: 'bubble-sort-swaps',
    description: 'Count total swaps needed to sort using bubble sort.\n\nInput: First line N. Second line N integers.\nOutput: Single integer.\n\nExample:\nInput:\n4\n4 3 2 1\nOutput:\n6',
    difficulty: 'medium', category: 'algorithms',
    test_cases: [
      { input: '4\n4 3 2 1', expected_output: '6', is_public: true, weight: 1 },
      { input: '3\n1 2 3', expected_output: '0', is_public: true, weight: 1 },
      { input: '3\n3 1 2', expected_output: '2', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Flood Fill',
    slug: 'flood-fill',
    description: 'Perform flood fill on an image starting at (sr, sc) with new color.\n\nInput: First line R C sr sc newColor. Next R lines have C space-separated colors.\nOutput: Grid after flood fill.\n\nExample:\nInput:\n3 3 1 1 2\n1 1 1\n1 1 0\n1 0 1\nOutput:\n2 2 2\n2 2 0\n2 0 1',
    difficulty: 'medium', category: 'algorithms',
    test_cases: [
      { input: '3 3 1 1 2\n1 1 1\n1 1 0\n1 0 1', expected_output: '2 2 2\n2 2 0\n2 0 1', is_public: true, weight: 1 },
      { input: '2 2 0 0 3\n1 1\n1 1', expected_output: '3 3\n3 3', is_public: false, weight: 2 },
    ],
  },

  // ─── HARD: ALGORITHMS ──────────────────────────────────────────
  {
    title: 'Longest Common Subsequence',
    slug: 'lcs',
    description: 'Find length of LCS of two strings.\n\nInput: Two lines, each a string.\nOutput: Single integer.\n\nExample:\nInput:\nabcde\nace\nOutput:\n3',
    difficulty: 'hard', category: 'algorithms',
    test_cases: [
      { input: 'abcde\nace', expected_output: '3', is_public: true, weight: 1 },
      { input: 'abc\nabc', expected_output: '3', is_public: true, weight: 1 },
      { input: 'abc\ndef', expected_output: '0', is_public: false, weight: 1 },
      { input: 'oxcpqrsvwf\nmynpqrsvwf', expected_output: '7', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Coin Change',
    slug: 'coin-change',
    description: 'Minimum coins to make amount.\n\nInput: First line amount. Second line coin denominations.\nOutput: Minimum coins or -1.\n\nExample:\nInput:\n11\n1 5 6 9\nOutput:\n2',
    difficulty: 'hard', category: 'algorithms',
    test_cases: [
      { input: '11\n1 5 6 9', expected_output: '2', is_public: true, weight: 1 },
      { input: '3\n2', expected_output: '-1', is_public: true, weight: 1 },
      { input: '0\n1 2 3', expected_output: '0', is_public: false, weight: 1 },
      { input: '100\n1 5 10 25', expected_output: '4', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Trapping Rain Water',
    slug: 'trapping-rain-water',
    description: 'Calculate water trapped.\n\nInput: First line N. Second line N heights.\nOutput: Total water.\n\nExample:\nInput:\n12\n0 1 0 2 1 0 1 3 2 1 2 1\nOutput:\n6',
    difficulty: 'hard', category: 'algorithms',
    test_cases: [
      { input: '12\n0 1 0 2 1 0 1 3 2 1 2 1', expected_output: '6', is_public: true, weight: 1 },
      { input: '6\n4 2 0 3 2 5', expected_output: '9', is_public: true, weight: 1 },
      { input: '3\n1 0 1', expected_output: '1', is_public: false, weight: 1 },
      { input: '1\n5', expected_output: '0', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Edit Distance',
    slug: 'edit-distance',
    description: 'Minimum operations (insert/delete/replace) to convert word1 to word2.\n\nInput: Two lines, each a string.\nOutput: Single integer.\n\nExample:\nInput:\nhorse\nros\nOutput:\n3',
    difficulty: 'hard', category: 'algorithms',
    test_cases: [
      { input: 'horse\nros', expected_output: '3', is_public: true, weight: 1 },
      { input: 'intention\nexecution', expected_output: '5', is_public: true, weight: 1 },
      { input: 'abc\nabc', expected_output: '0', is_public: false, weight: 1 },
      { input: 'abc\n', expected_output: '3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Word Break',
    slug: 'word-break',
    description: 'Can string s be segmented into words from dictionary?\n\nInput: First line is s. Second line is N. Next N lines are dictionary words.\nOutput: true or false\n\nExample:\nInput:\nleetcode\n2\nleet\ncode\nOutput:\ntrue',
    difficulty: 'hard', category: 'algorithms',
    test_cases: [
      { input: 'leetcode\n2\nleet\ncode', expected_output: 'true', is_public: true, weight: 1 },
      { input: 'catsandog\n5\ncats\ndog\nsand\nand\ncat', expected_output: 'false', is_public: true, weight: 1 },
      { input: 'applepenapple\n3\napple\npen\napplepenapplee', expected_output: 'true', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Unique Paths',
    slug: 'unique-paths',
    description: 'Count unique paths from top-left to bottom-right of M x N grid (only right/down moves).\n\nInput: Two integers M and N.\nOutput: Single integer.\n\nExample:\nInput:\n3 7\nOutput:\n28',
    difficulty: 'hard', category: 'algorithms',
    test_cases: [
      { input: '3 7', expected_output: '28', is_public: true, weight: 1 },
      { input: '3 2', expected_output: '3', is_public: true, weight: 1 },
      { input: '1 1', expected_output: '1', is_public: false, weight: 1 },
      { input: '5 5', expected_output: '70', is_public: false, weight: 2 },
    ],
  },

  // ─── HARD: STRINGS ─────────────────────────────────────────────
  {
    title: 'Longest Palindromic Substring',
    slug: 'longest-palindrome',
    description: 'Find longest palindromic substring.\n\nInput: Single string.\nOutput: The longest palindrome (first if tie).\n\nExample:\nInput:\nbabad\nOutput:\nbab',
    difficulty: 'hard', category: 'strings',
    test_cases: [
      { input: 'babad', expected_output: 'bab', is_public: true, weight: 1 },
      { input: 'cbbd', expected_output: 'bb', is_public: true, weight: 1 },
      { input: 'a', expected_output: 'a', is_public: false, weight: 1 },
      { input: 'racecar', expected_output: 'racecar', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Minimum Window Substring',
    slug: 'min-window-substring',
    description: 'Find minimum window in s that contains all characters of t.\n\nInput: First line is s. Second line is t.\nOutput: Minimum window or empty string.\n\nExample:\nInput:\nADOBECODEBANC\nABC\nOutput:\nBANC',
    difficulty: 'hard', category: 'strings',
    test_cases: [
      { input: 'ADOBECODEBANC\nABC', expected_output: 'BANC', is_public: true, weight: 1 },
      { input: 'a\na', expected_output: 'a', is_public: true, weight: 1 },
      { input: 'a\nb', expected_output: '', is_public: false, weight: 2 },
    ],
  },

  // ─── HARD: DATA STRUCTURES ─────────────────────────────────────
  {
    title: 'LRU Cache',
    slug: 'lru-cache',
    description: 'Implement LRU cache. GET key (return -1 if missing) and PUT key value.\n\nInput: First line capacity. Second line N. Each line GET key or PUT key value.\nOutput: For each GET, value or -1.\n\nExample:\nInput:\n2\n5\nPUT 1 1\nPUT 2 2\nGET 1\nPUT 3 3\nGET 2\nOutput:\n1\n-1',
    difficulty: 'hard', category: 'data-structures',
    test_cases: [
      { input: '2\n5\nPUT 1 1\nPUT 2 2\nGET 1\nPUT 3 3\nGET 2', expected_output: '1\n-1', is_public: true, weight: 1 },
      { input: '1\n3\nPUT 1 1\nGET 1\nPUT 2 2', expected_output: '1', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Merge K Sorted Arrays',
    slug: 'merge-k-sorted',
    description: 'Merge K sorted arrays.\n\nInput: First line K. Next K lines each have sorted integers.\nOutput: Merged sorted array.\n\nExample:\nInput:\n3\n1 4 7\n2 5 8\n3 6 9\nOutput:\n1 2 3 4 5 6 7 8 9',
    difficulty: 'hard', category: 'data-structures',
    test_cases: [
      { input: '3\n1 4 7\n2 5 8\n3 6 9', expected_output: '1 2 3 4 5 6 7 8 9', is_public: true, weight: 1 },
      { input: '2\n1 3 5\n2 4 6', expected_output: '1 2 3 4 5 6', is_public: true, weight: 1 },
      { input: '1\n1 2 3', expected_output: '1 2 3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Sliding Window Maximum',
    slug: 'sliding-window-max',
    description: 'Find maximum in each sliding window of size K.\n\nInput: First line N and K. Second line N integers.\nOutput: Space-separated maximums.\n\nExample:\nInput:\n8 3\n1 3 -1 -3 5 3 6 7\nOutput:\n3 3 5 5 6 7',
    difficulty: 'hard', category: 'data-structures',
    test_cases: [
      { input: '8 3\n1 3 -1 -3 5 3 6 7', expected_output: '3 3 5 5 6 7', is_public: true, weight: 1 },
      { input: '4 2\n1 2 3 4', expected_output: '2 3 4', is_public: true, weight: 1 },
      { input: '3 3\n1 2 3', expected_output: '3', is_public: false, weight: 2 },
    ],
  },
  {
    title: 'Trie Insert Search',
    slug: 'trie-impl',
    description: 'Implement trie. INSERT word and SEARCH word (exact match).\n\nInput: First line N. Each line INSERT word or SEARCH word.\nOutput: For each SEARCH, true or false.\n\nExample:\nInput:\n4\nINSERT apple\nINSERT app\nSEARCH app\nSEARCH ap\nOutput:\ntrue\nfalse',
    difficulty: 'hard', category: 'data-structures',
    test_cases: [
      { input: '4\nINSERT apple\nINSERT app\nSEARCH app\nSEARCH ap', expected_output: 'true\nfalse', is_public: true, weight: 1 },
      { input: '3\nINSERT hello\nSEARCH hello\nSEARCH hell', expected_output: 'true\nfalse', is_public: false, weight: 2 },
    ],
  },
];

async function seed() {
  console.log(`Seeding ${problems.length} problems...`);
  let inserted = 0;
  let skipped  = 0;

  for (const p of problems) {
    try {
      // Check if slug already exists
      const existing = await pool.query(
        'SELECT id FROM problems WHERE slug = $1',
        [p.slug]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await pool.query(
          `UPDATE problems SET
             title = $1, description = $2, difficulty = $3, category = $4,
             test_cases = $5, supported_languages = $6, is_active = true
           WHERE slug = $7`,
          [
            p.title, p.description, p.difficulty, p.category,
            JSON.stringify(p.test_cases),
            JSON.stringify(['javascript', 'python', 'cpp', 'java']),
            p.slug,
          ]
        );
        skipped++;
        process.stdout.write('U');
      } else {
        await pool.query(
          `INSERT INTO problems
             (title, slug, description, difficulty, category, time_limit_seconds,
              test_cases, supported_languages, is_active)
           VALUES ($1,$2,$3,$4,$5,1800,$6,$7,true)`,
          [
            p.title, p.slug, p.description, p.difficulty, p.category,
            JSON.stringify(p.test_cases),
            JSON.stringify(['javascript', 'python', 'cpp', 'java']),
          ]
        );
        inserted++;
        process.stdout.write('.');
      }
    } catch (err) {
      console.error(`\nFailed: ${p.slug} — ${err.message}`);
    }
  }

  console.log(`\n\nDone! Inserted: ${inserted} | Updated: ${skipped}`);

  // Summary
  const summary = await pool.query(
    `SELECT difficulty, category, COUNT(*) as count
     FROM problems WHERE is_active = true
     GROUP BY difficulty, category
     ORDER BY difficulty, category`
  );
  console.log('\nProblem breakdown:');
  console.table(summary.rows);

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});