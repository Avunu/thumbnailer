<?php

/**
 * Plugin Name:       Thumbnailer
 * Plugin URI:        https://github.com/Avunu/thumbnailer
 * Description:       Makes the Thumbnailer client-side thumbnail library (PDF, PostScript, TIFF and common images) available on selected posts and pages.
 * x-release-please-start-version
 * Version:           1.1.0
 * x-release-please-end
 * Author:            Avunu LLC
 * Author URI:        https://avu.nu
 * Text Domain:       thumbnailer
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Tested up to:      6.9
 * Update URI:        https://github.com/Avunu/thumbnailer/
 * License:           AGPL-3.0-only
 * License URI:       https://www.gnu.org/licenses/agpl-3.0.html
 *
 * Requires at least 6.5 for wp_enqueue_script_module(); the plugin fatals on
 * anything older. Update URI keeps wordpress.org from ever claiming the
 * "thumbnailer" slug out from under this install.
 */

declare(strict_types=1);

defined('ABSPATH') || exit;

require_once __DIR__ . '/vendor/autoload.php';

define('THUMBNAILER_VERSION', '1.1.0'); // x-release-please-version
define('THUMBNAILER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('THUMBNAILER_PLUGIN_URL', plugin_dir_url(__FILE__));

// Self-update from GitHub releases. The zip attached to each release bundles
// both dist/ and vendor/, so end users need neither Node nor Composer.
$thumbnailerUpdateChecker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
    'https://github.com/Avunu/thumbnailer/',
    __FILE__,
    'thumbnailer'
);
// Download the built release asset rather than GitHub's source tarball, which
// carries neither dist/ nor vendor/ and would install a dead plugin.
$thumbnailerUpdateChecker->getVcsApi()->enableReleaseAssets('/thumbnailer\.zip$/');

(new \Avunu\Thumbnailer\Plugin(__FILE__, THUMBNAILER_VERSION))->register();
