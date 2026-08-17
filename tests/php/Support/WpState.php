<?php

declare(strict_types=1);

namespace Avunu\Thumbnailer\Tests\Support;

/**
 * Mutable global state for the in-memory WordPress fake in functions.php.
 *
 * A singleton because the functions it backs are global, exactly as WordPress's
 * are. WordPressTestCase resets it between tests.
 */
final class WpState
{
    private static ?self $instance = null;

    /** @var array<string, list<callable>> */
    public array $actions = [];

    /** @var array<string, mixed> */
    public array $options = [];

    public bool $isAdmin = false;
    public bool $isSingle = false;
    public bool $isPage = false;

    public ?\WP_Post $post = null;

    /** @var list<array{handle: string, src: string, deps: array<int, string>, version: mixed}> */
    public array $enqueuedModules = [];

    /** @var list<array{title: string, menu: string, capability: string, slug: string}> */
    public array $optionsPages = [];

    /** @var array<string, array{group: string, args: array<string, mixed>}> */
    public array $registeredSettings = [];

    /** @var list<array{id: string, title: string, page: string}> */
    public array $settingsSections = [];

    /** @var list<array{id: string, title: string, page: string, section: string}> */
    public array $settingsFields = [];

    public static function instance(): self
    {
        return self::$instance ??= new self();
    }

    public static function reset(): void
    {
        self::$instance = new self();
    }

    /**
     * @return list<callable>
     */
    public function callbacksFor(string $hook): array
    {
        return $this->actions[$hook] ?? [];
    }

    public function hasAction(string $hook): bool
    {
        return $this->callbacksFor($hook) !== [];
    }
}
