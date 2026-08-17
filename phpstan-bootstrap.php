<?php

declare(strict_types=1);

// ABSPATH is defined by WordPress before any plugin loads. Defining it here
// keeps PHPStan from treating the `defined('ABSPATH') || exit;` guard as an
// always-terminating branch and marking everything after it unreachable.
if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
