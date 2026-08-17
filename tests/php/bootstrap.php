<?php

declare(strict_types=1);

require_once __DIR__ . '/../../vendor/autoload.php';

// The WordPress fake has to be in place before any test loads Plugin.php,
// which calls defined('ABSPATH') at include time.
require_once __DIR__ . '/Support/functions.php';
