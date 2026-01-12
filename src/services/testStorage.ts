/**
 * Simple storage test - run this from browser console or a test page
 * to verify Supabase Storage is working correctly
 */

import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'documents'

export async function testSupabaseStorage() {
    console.log('🧪 Starting Supabase Storage Test...')
    console.log('=' .repeat(50))

    // Test 0: Check authentication
    console.log('\n🔐 Test 0: Checking authentication...')
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) {
        console.error('❌ Auth error:', authError.message)
        return false
    }
    if (!session?.user) {
        console.error('❌ Not logged in! Please login first.')
        return false
    }
    console.log('✅ Logged in as:', session.user.email)
    console.log('   User ID:', session.user.id)

    // Note: listBuckets() requires service role, skip it
    console.log('\n📦 Test 1: Bucket check (skipped - requires admin)')
    console.log('   Assuming bucket "documents" exists (check Supabase Dashboard)')

    // Test 2: Try to list files in YOUR folder (based on user ID)
    const userId = session.user.id
    console.log('\n📂 Test 2: Listing files in your folder...')
    console.log(`   Looking in: ${userId}/`)
    try {
        const startTime = Date.now()
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(userId, { limit: 5 })
        const duration = Date.now() - startTime
        
        if (error) {
            console.error(`❌ Failed to list files (${duration}ms):`, error.message)
            console.error('   Error details:', JSON.stringify(error, null, 2))
            console.error('   This usually means RLS policies are blocking access')
            return false
        }
        console.log(`✅ Listed ${data?.length || 0} items in ${duration}ms`)
        if (data && data.length > 0) {
            console.log('   Files:', data.map(f => f.name).join(', '))
        }
    } catch (err) {
        console.error('❌ Error listing files:', (err as Error).message)
        return false
    }

    // Test 3: Try to upload a tiny test file
    console.log('\n⬆️ Test 3: Uploading test file (tiny 50 byte text file)...')
    try {
        const testContent = `Test file created at ${new Date().toISOString()}`
        const testBlob = new Blob([testContent], { type: 'text/plain' })
        const testPath = `${userId}/test_${Date.now()}.txt`
        
        console.log(`   File size: ${testBlob.size} bytes`)
        console.log(`   Uploading to: ${testPath}`)
        console.log('   ⏳ Waiting for Supabase response...')
        const uploadStart = Date.now()
        
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(testPath, testBlob, {
                cacheControl: '3600',
                upsert: true,
            })
        
        const uploadTime = Date.now() - uploadStart
        
        if (error) {
            console.error(`❌ Upload failed after ${uploadTime}ms:`, error.message)
            console.error('   Error details:', JSON.stringify(error, null, 2))
            if (error.message.includes('policy')) {
                console.error('   This is an RLS policy issue - check bucket policies in Supabase Dashboard')
            }
            if (error.message.includes('Bucket not found')) {
                console.error('   The bucket "documents" does not exist!')
            }
            return false
        }
        
        console.log(`✅ Upload succeeded in ${uploadTime}ms!`)
        console.log(`   Path: ${data?.path}`)
        
        // Cleanup - delete the test file
        console.log('\n🗑️ Cleaning up test file...')
        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([testPath])
        
        if (deleteError) {
            console.warn('⚠️ Could not delete test file:', deleteError.message)
        } else {
            console.log('✅ Test file deleted')
        }
        
    } catch (err) {
        console.error('❌ Exception during upload test:', (err as Error).message)
        console.error('   Stack:', (err as Error).stack)
        return false
    }

    console.log('\n' + '=' .repeat(50))
    console.log('✅ All tests passed! Supabase Storage is working.')
    return true
}

// Export for easy testing
export default testSupabaseStorage

/**
 * Run this in browser console to test storage:
 * 
 * 1. Open browser DevTools (F12)
 * 2. Go to Console tab
 * 3. Type: import('/src/services/testStorage.ts').then(m => m.testSupabaseStorage())
 * 4. Press Enter
 * 
 * Or call window.__testStorage() after adding the debug helper below
 */

/**
 * Simple file upload without any timeouts or complexity
 * Use this to test if basic Supabase uploads work
 */
export async function simpleUpload(file: File): Promise<{ success: boolean; path?: string; error?: string }> {
    console.log('🧪 Simple upload test starting...')
    console.log(`   File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
    
    try {
        // Get user
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
            return { success: false, error: 'Not logged in' }
        }
        
        const userId = session.user.id
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${userId}/${timestamp}_${sanitizedName}`
        
        console.log(`   Uploading to: ${filePath}`)
        console.log('   ⏳ Waiting for Supabase (no timeout)...')
        
        const startTime = Date.now()
        
        // Simple upload - NO timeout, NO retry, just raw Supabase call
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
            })
        
        const duration = Date.now() - startTime
        
        if (error) {
            console.error(`❌ Upload failed after ${duration}ms:`, error.message)
            return { success: false, error: error.message }
        }
        
        console.log(`✅ Upload succeeded in ${duration}ms!`)
        console.log(`   Path: ${data?.path}`)
        
        return { success: true, path: data?.path }
        
    } catch (err) {
        const error = err as Error
        console.error('❌ Exception during upload:', error.message)
        return { success: false, error: error.message }
    }
}

// Add to window for easy console access
if (typeof window !== 'undefined') {
    const w = window as typeof window & { 
        __testStorage?: typeof testSupabaseStorage
        __simpleUpload?: typeof simpleUpload 
    }
    w.__testStorage = testSupabaseStorage
    w.__simpleUpload = simpleUpload
}

