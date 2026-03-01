const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://lqktevnjfywrujdhetlo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5MzMwNiwiZXhwIjoyMDg2NjY5MzA2fQ.tevtSheI13dCAzxnl9YXTVZKETGfRN_Rmfe3MER_vVk"; // SERVICE ROLE

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const item = {
        name: "Test Ingredient " + Date.now(),
        category: "outros",
        unit: "unidade",
        current_quantity: 10,
        minimum_quantity: 5,
        unit_price: 1.5,
        waste_factor: 0,
        user_id: "42fc1df9-f7a6-4da6-b2e2-96dcb3a34d0c"
    };

    console.log("Attempting to insert item:", item);

    const { data, error } = await supabase
        .from('stock_items')
        .insert(item)
        .select();

    if (error) {
        console.error("Error Details:", JSON.stringify(error, null, 2));
    } else {
        console.log("Success! Data:", JSON.stringify(data, null, 2));
    }
}

test();
