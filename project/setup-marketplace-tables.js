import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function setupMarketplaceTables() {
  console.log('Setting up marketplace transaction tables...')

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Read the SQL file
    const sqlContent = readFileSync(join(__dirname, 'marketplace-transaction-tables.sql'), 'utf8')

    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`)

        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        })

        if (error) {
          console.error('Error executing statement:', error)
          console.error('Statement was:', statement)
        }
      }
    }

    console.log('✅ Marketplace tables setup complete')

  } catch (error) {
    console.error('Error setting up tables:', error)
  }
}

setupMarketplaceTables()