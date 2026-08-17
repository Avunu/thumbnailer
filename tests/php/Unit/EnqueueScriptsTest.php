<?php

declare(strict_types=1);

namespace Avunu\Thumbnailer\Tests\Unit;

use Avunu\Thumbnailer\Tests\Support\WordPressTestCase;

final class EnqueueScriptsTest extends WordPressTestCase
{
    private function onSinglePost(int $id): void
    {
        $this->wp->isSingle = true;
        $this->wp->post = new \WP_Post($id);
    }

    public function testEnqueuesOnAConfiguredPost(): void
    {
        $plugin = $this->withOptions(['post_ids' => '5,7']);
        $this->onSinglePost(7);

        $plugin->enqueueScripts();

        self::assertCount(1, $this->wp->enqueuedModules);
        self::assertSame('thumbnailer', $this->wp->enqueuedModules[0]['handle']);
        self::assertStringEndsWith('/dist/thumbnailer.js', $this->wp->enqueuedModules[0]['src']);
    }

    public function testDoesNotEnqueueOnAnUnconfiguredPost(): void
    {
        $plugin = $this->withOptions(['post_ids' => '5,7']);
        $this->onSinglePost(9);

        $plugin->enqueueScripts();

        self::assertSame([], $this->wp->enqueuedModules);
    }

    public function testDoesNotEnqueueWhenNoPostsAreConfigured(): void
    {
        $plugin = $this->bootedPlugin();
        $this->onSinglePost(7);

        $plugin->enqueueScripts();

        self::assertSame([], $this->wp->enqueuedModules);
    }

    public function testDoesNotEnqueueOnAnArchive(): void
    {
        // Neither is_single() nor is_page(): a category or home view. The
        // configured ID may still be the queried object, so the guard has to be
        // the view type, not just the ID.
        $plugin = $this->withOptions(['post_ids' => '7']);
        $this->wp->post = new \WP_Post(7);

        $plugin->enqueueScripts();

        self::assertSame([], $this->wp->enqueuedModules);
    }

    public function testDoesNotEnqueueWhenThereIsNoPost(): void
    {
        // is_single() true with a null $post happens on a 404 and inside some
        // feed requests. The original code dereferenced $post->ID unguarded.
        $plugin = $this->withOptions(['post_ids' => '7']);
        $this->wp->isSingle = true;
        $this->wp->post = null;

        $plugin->enqueueScripts();

        self::assertSame([], $this->wp->enqueuedModules);
    }

    public function testEnqueuesOnAConfiguredPage(): void
    {
        $plugin = $this->withOptions(['post_ids' => '12']);
        $this->wp->isPage = true;
        $this->wp->post = new \WP_Post(12);

        $plugin->enqueueScripts();

        self::assertCount(1, $this->wp->enqueuedModules);
    }

    public function testCacheBustsOnThePluginVersionNotFilemtime(): void
    {
        // filemtime() was the original cache-buster. It warns when dist/ is
        // absent, and in a Nix-built install every store mtime is normalised to
        // the epoch, so it returns the same constant for every release.
        $plugin = $this->withOptions(['post_ids' => '7']);
        $this->onSinglePost(7);

        $plugin->enqueueScripts();

        self::assertSame(self::VERSION, $this->wp->enqueuedModules[0]['version']);
    }

    public function testEmitsNoWarningWhenTheBuildOutputIsMissing(): void
    {
        // PLUGIN_FILE points at a path that does not exist, so dist/ is
        // certainly absent. Any filesystem call on it would raise a warning,
        // which PHPUnit is configured to fail on.
        $plugin = $this->withOptions(['post_ids' => '7']);
        $this->onSinglePost(7);

        $plugin->enqueueScripts();

        self::assertCount(1, $this->wp->enqueuedModules);
    }

    public function testRegistersTheFrontendHookOnBoot(): void
    {
        $this->bootedPlugin();

        self::assertTrue($this->wp->hasAction('wp_enqueue_scripts'));
    }

    public function testDoesNotRegisterAdminHooksOnTheFrontend(): void
    {
        $this->wp->isAdmin = false;
        $this->bootedPlugin();

        self::assertFalse($this->wp->hasAction('admin_menu'));
        self::assertFalse($this->wp->hasAction('admin_init'));
    }
}
