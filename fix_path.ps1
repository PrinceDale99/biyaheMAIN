$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path $gcloudPath) {
    $oldPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($oldPath -notlike "*$gcloudPath*") {
        $newPath = $oldPath + ";" + $gcloudPath
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Output "SUCCESS: PATH updated to the correct Program Files location."
    } else {
        Write-Output "PATH already contains the correct gcloud location."
    }
} else {
    Write-Output "ERROR: Gcloud folder not found even in Program Files."
}
