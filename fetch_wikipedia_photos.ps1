$units = @(
    @{ id='J20'; page='Chengdu_J-20' },
    @{ id='RAFALE'; page='Dassault_Rafale' },
    @{ id='F15EX'; page='Boeing_F-15EX_Eagle_II' },
    @{ id='JAS39'; page='Saab_JAS_39_Gripen' },
    @{ id='J10C'; page='Chengdu_J-10' },
    @{ id='JF17'; page='CAC/PAC_JF-17_Thunder' },
    @{ id='F5E'; page='Northrop_F-5' },
    @{ id='YAK130'; page='Yakovlev_Yak-130' },
    @{ id='L159'; page='Aero_L-159_ALCA' },
    @{ id='T14'; page='T-14_Armata' },
    @{ id='MK4'; page='Merkava' },
    @{ id='LEC'; page='Leclerc_tank' },
    @{ id='T99A'; page='Type_99_tank' },
    @{ id='BOXER'; page='Boxer_(armoured_fighting_vehicle)' },
    @{ id='CM34'; page='CM-32_Armoured_Vehicle' },
    @{ id='M113T'; page='M113_armored_personnel_carrier' },
    @{ id='HMMWV'; page='Humvee' },
    @{ id='S500'; page='S-500_missile_system' },
    @{ id='DAVID'; page='David%27s_Sling' },
    @{ id='TK3'; page='Tien_Kung_III' },
    @{ id='IRIST'; page='IRIS-T' },
    @{ id='BUKM3'; page='Buk_missile_system' },
    @{ id='GEPARD'; page='Flakpanzer_Gepard' },
    @{ id='TC2'; page='Sky_Sword_II' },
    @{ id='STAR'; page='Starstreak' },
    @{ id='KDX3'; page='Sejong_the_Great-class_destroyer' },
    @{ id='TYPE45'; page='Type_45_destroyer' },
    @{ id='MOGAMI'; page='Mogami-class_frigate' },
    @{ id='YASEN'; page='Yasen-class_submarine' },
    @{ id='SORYU'; page='S%C5%8Dry%C5%AB-class_submarine' },
    @{ id='GOWIND'; page='Gowind-class_corvette' },
    @{ id='SAAR6'; page='Sa%27ar_6-class_corvette' },
    @{ id='SBS'; page='Swimmer_Delivery_Vehicle' },
    @{ id='KJ500'; page='Shaanxi_KJ-500' },
    @{ id='RQ4'; page='Northrop_Grumman_RQ-4_Global_Hawk' },
    @{ id='ATACMS'; page='MGM-140_ATACMS' },
    @{ id='STORM'; page='Storm_Shadow' },
    @{ id='CAESAR'; page='CAESAR_self-propelled_howitzer' },
    @{ id='ARCHER'; page='Archer_Artillery_System' },
    @{ id='SW600'; page='AeroVironment_Switchblade' },
    @{ id='ORION'; page='Kronshtadt_Orion' },
    @{ id='SW300'; page='AeroVironment_Switchblade' },
    @{ id='MORTAR'; page='Cardom' }
)

$targetDir = "C:\Users\XQ\.gemini\antigravity-ide\scratch\defense-budget-15\assets\units"

foreach ($u in $units) {
    $dest = Join-Path $targetDir "$($u.id).jpg"
    if (Test-Path $dest) {
        $size = (Get-Item $dest).Length
        if ($size -gt 2000) {
            Write-Host "[OK EXISTS] $($u.id) ($size bytes)"
            continue
        }
    }
    
    $url = "https://en.wikipedia.org/api/rest_v1/page/summary/$($u.page)"
    try {
        $resp = Invoke-RestMethod -Uri $url -Headers @{'User-Agent'='MilitaryCardGame/1.0 (contact@example.com)'}
        $imgUrl = $null
        if ($resp.thumbnail -and $resp.thumbnail.source) {
            $imgUrl = $resp.thumbnail.source
        } elseif ($resp.originalimage -and $resp.originalimage.source) {
            $imgUrl = $resp.originalimage.source
        }
        
        if ($imgUrl) {
            Invoke-WebRequest -Uri $imgUrl -OutFile $dest -Headers @{'User-Agent'='MilitaryCardGame/1.0 (contact@example.com)'}
            Write-Host "[DOWNLOADED] $($u.id) from $imgUrl"
        } else {
            Write-Host "[NO IMAGE] $($u.id)"
        }
    } catch {
        Write-Host "[ERROR] $($u.id): $_"
    }
    Start-Sleep -Milliseconds 150
}
Write-Host "Completed fetching Wikipedia official photos!"
