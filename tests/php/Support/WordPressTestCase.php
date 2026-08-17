<?php

declare(strict_types=1);

namespace Avunu\Thumbnailer\Tests\Support;

use Avunu\Thumbnailer\Plugin;
use PHPUnit\Framework\TestCase;

abstract class WordPressTestCase extends TestCase
{
    protected WpState $wp;

    /** Stands in for the installed plugin file; only its dirname is used. */
    protected const PLUGIN_FILE = '/var/www/wp-content/plugins/thumbnailer/thumbnailer.php';

    protected const VERSION = '1.2.3';

    protected function setUp(): void
    {
        parent::setUp();
        WpState::reset();
        $this->wp = WpState::instance();
    }

    /**
     * Builds a plugin instance and runs boot(), which is what loads the stored
     * options. Set `$this->wp->options` before calling.
     */
    protected function bootedPlugin(): Plugin
    {
        $plugin = new Plugin(self::PLUGIN_FILE, self::VERSION);
        $plugin->boot();

        return $plugin;
    }

    /**
     * @param array<string, mixed> $options
     */
    protected function withOptions(array $options): Plugin
    {
        $this->wp->options['thumbnailer_options'] = $options;

        return $this->bootedPlugin();
    }
}
