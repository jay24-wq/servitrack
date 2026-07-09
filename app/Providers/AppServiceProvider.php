<?php

namespace App\Providers;

use App\Models\ServiceTicket;
use App\Policies\ServiceTicketPolicy;
use App\Models\RepairTask;
use App\Policies\RepairTaskPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 🔒 KEAMANAN: Register Policies untuk mencegah IDOR
        Gate::policy(ServiceTicket::class, ServiceTicketPolicy::class);
        Gate::policy(RepairTask::class, RepairTaskPolicy::class);
    }
}
