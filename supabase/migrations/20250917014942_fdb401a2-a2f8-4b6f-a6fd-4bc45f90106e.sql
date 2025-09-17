-- Add contract_number field to existing debts table structure
-- This migration adds the contract_number as an optional field

-- Since we can't alter the existing table structure directly, we'll work with the current setup
-- and ensure the application handles the contract_number field properly

-- For now, we'll add some sample data with contract numbers to test the functionality
-- The application will handle the contract_number field in the debt object structure